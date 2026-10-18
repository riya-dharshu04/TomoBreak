/**
 * Reminder scheduler state. Runs in the service worker.
 *
 * Chrome may stop the service worker at any moment, so nothing here keeps
 * state in memory: due times live in storage (`schedule`) and wake-ups are
 * chrome.alarms.
 *
 * Life of a reminder:
 *   1. `mode:<id>` alarm fires at nextDueAt → the mode becomes *pending*.
 *   2. lib/delivery.ts waits for a natural pause (re-checked by the periodic
 *      `focus:check` alarm and by activity) and shows one visit for every
 *      pending mode.
 *   3. The answer (or a timeout) finishes the visit and schedules each mode
 *      again.
 */
import { applyBondAnswer, markAnnounced } from '@/lib/bond';
import { MODE_IDS, SCHEDULED_MODES, SNOOZE_MIN, effectiveIntervalMin, nextDelayMin } from '@/lib/modes';
import { clearNotification } from '@/lib/notify';
import { handlePomodoroAnswer } from '@/lib/pomodoro';
import { recordAnswer } from '@/lib/stats';
import { getItem, updateItem } from '@/lib/storage';
import type { ActiveVisit, Answer, AnswerOutcome, ModeId, ScheduleState, VisitChannel } from '@/utils/types';

const MINUTE = 60_000;
const MODE_ALARM_PREFIX = 'mode:';
export const VISIT_TIMEOUT_ALARM = 'visit:timeout';
export const CHECK_ALARM = 'focus:check';
/** How often pending reminders re-check for a pause (Chrome's minimum is 30 s). */
const CHECK_PERIOD_MIN = 0.5;
/**
 * An overlay visit takes at most ~75 s (walk in, 60 s bubble, reaction, walk
 * out). If no answer arrived by then the tab was closed or navigated.
 */
const VISIT_TIMEOUT_MIN = 2;
/** Notifications get the same 60 s as the on-page bubble before counting as ignored. */
const NOTIFICATION_TIMEOUT_MIN = 1;

function modeAlarmName(mode: ModeId): string {
  return `${MODE_ALARM_PREFIX}${mode}`;
}

export function modeFromAlarm(name: string): ModeId | null {
  if (!name.startsWith(MODE_ALARM_PREFIX)) return null;
  const id = name.slice(MODE_ALARM_PREFIX.length);
  return MODE_IDS.find((mode) => mode === id) ?? null;
}

export interface PendingSet {
  modes: ModeId[];
  /** Earliest pendingSince among them; drives the 10-minute maximum delay. */
  oldest: number;
}

export function pendingModes(schedule: ScheduleState): PendingSet | null {
  const modes: ModeId[] = [];
  let oldest = Infinity;
  for (const mode of MODE_IDS) {
    const since = schedule.modes[mode]?.pendingSince;
    if (since === undefined || since === null) continue;
    modes.push(mode);
    oldest = Math.min(oldest, since);
  }
  return modes.length > 0 ? { modes, oldest } : null;
}

function isStale(visit: ActiveVisit, now: number): boolean {
  return now - visit.shownAt > VISIT_TIMEOUT_MIN * MINUTE;
}

/**
 * Make chrome.alarms match the stored schedule: one alarm per mode that is
 * not yet due, and the periodic check alarm while anything is pending.
 */
async function syncAlarms(schedule: ScheduleState): Promise<void> {
  const now = Date.now();
  for (const mode of MODE_IDS) {
    const name = modeAlarmName(mode);
    const entry = schedule.modes[mode];
    if (!entry || entry.pendingSince !== null) {
      await chrome.alarms.clear(name);
      continue;
    }
    const alarm = await chrome.alarms.get(name);
    if (!alarm || Math.abs(alarm.scheduledTime - entry.nextDueAt) > 1000) {
      // A due time in the past (e.g. after a browser restart) fires right away.
      await chrome.alarms.create(name, { when: Math.max(entry.nextDueAt, now + 1000) });
    }
  }
  if (pendingModes(schedule)) {
    if (!(await chrome.alarms.get(CHECK_ALARM))) {
      await chrome.alarms.create(CHECK_ALARM, { delayInMinutes: CHECK_PERIOD_MIN, periodInMinutes: CHECK_PERIOD_MIN });
    }
  } else {
    await chrome.alarms.clear(CHECK_ALARM);
  }
}

/**
 * Bring storage and alarms in line with the current settings. Safe to call
 * any time (install, browser start, settings change); it never moves a due
 * time unless the interval changed or the mode was switched off and on.
 */
export async function syncSchedules(): Promise<void> {
  const settings = await getItem('settings');
  const now = Date.now();

  const schedule = await updateItem('schedule', (current) => {
    const modes = { ...current.modes };
    for (const mode of MODE_IDS) {
      const active = settings.enabled && SCHEDULED_MODES.includes(mode) && settings.modes[mode].enabled;
      if (!active) {
        delete modes[mode];
        continue;
      }
      const interval = effectiveIntervalMin(settings, mode);
      const existing = modes[mode];
      if (!existing || existing.intervalMin !== interval) {
        modes[mode] = { nextDueAt: now + nextDelayMin(settings, mode) * MINUTE, intervalMin: interval, pendingSince: null };
      }
    }
    const visit = current.activeVisit;
    const keepVisit = settings.enabled && visit !== null && !isStale(visit, now);
    return { ...current, modes, activeVisit: keepVisit ? visit : null };
  });

  if (!schedule.activeVisit) await chrome.alarms.clear(VISIT_TIMEOUT_ALARM);
  await syncAlarms(schedule);
}

/** A mode alarm fired: the reminder now waits for a natural pause. */
export async function markDue(mode: ModeId): Promise<void> {
  const now = Date.now();
  const schedule = await updateItem('schedule', (s) => {
    const entry = s.modes[mode];
    if (!entry || entry.pendingSince !== null) return s;
    // "Due" counts from now, not nextDueAt: after a browser restart an old
    // due time would otherwise skip the pause and force a visit at once.
    return { ...s, modes: { ...s.modes, [mode]: { ...entry, pendingSince: now } } };
  });
  await syncAlarms(schedule);
}

/** Push pending modes to a later time (e.g. the end of quiet hours). */
export async function deferModes(modes: readonly ModeId[], until: number): Promise<void> {
  const schedule = await updateItem('schedule', (s) => {
    const next = { ...s.modes };
    for (const mode of modes) {
      const entry = next[mode];
      if (entry) next[mode] = { ...entry, nextDueAt: until, pendingSince: null };
    }
    return { ...s, modes: next };
  });
  await syncAlarms(schedule);
}

/**
 * Atomically take the single visit slot. Returns false if another visit got
 * there first (two triggers can race inside one service worker).
 */
export async function claimVisit(visit: ActiveVisit): Promise<boolean> {
  const schedule = await updateItem('schedule', (s) => (s.activeVisit ? s : { ...s, activeVisit: visit }));
  return schedule.activeVisit?.id === visit.id;
}

/** Give the slot back when a visit could not be shown after all. */
export async function releaseVisit(visitId: string): Promise<void> {
  await updateItem('schedule', (s) => (s.activeVisit?.id === visitId ? { ...s, activeVisit: null } : s));
}

export async function startVisitTimeout(channel: VisitChannel): Promise<void> {
  const delayInMinutes = channel === 'notification' ? NOTIFICATION_TIMEOUT_MIN : VISIT_TIMEOUT_MIN;
  await chrome.alarms.create(VISIT_TIMEOUT_ALARM, { delayInMinutes });
}

/**
 * Atomically end the visit with this id and return it, or null if it already
 * ended. Two events can answer the same visit (a notification button click
 * is followed by its close event); only the first one gets the visit.
 * Setting lastVisitEndAt in the same write keeps tryDeliver from starting a
 * new visit before the modes are rescheduled.
 */
async function takeVisit(visitId: string): Promise<ActiveVisit | null> {
  const taken: { visit: ActiveVisit | null } = { visit: null };
  await updateItem('schedule', (s) => {
    if (s.activeVisit?.id !== visitId) return s;
    taken.visit = s.activeVisit;
    return { ...s, activeVisit: null, lastVisitEndAt: Date.now() };
  });
  return taken.visit;
}

/** Schedule each mode of a finished visit again. */
async function rescheduleModes(modes: readonly ModeId[], delayOverrideMin?: number): Promise<void> {
  const settings = await getItem('settings');
  const now = Date.now();
  const schedule = await updateItem('schedule', (s) => {
    const next = { ...s.modes };
    for (const mode of modes) {
      const entry = next[mode];
      if (!entry) continue; // e.g. a debug visit for a mode that is switched off
      const delay = delayOverrideMin ?? nextDelayMin(settings, mode);
      next[mode] = { ...entry, nextDueAt: now + delay * MINUTE, pendingSince: null };
    }
    return { ...s, modes: next };
  });
  await chrome.alarms.clear(VISIT_TIMEOUT_ALARM);
  await syncAlarms(schedule);
}

/**
 * The user answered a visit (or it timed out). Records stats and bond for
 * reminders, steers the Pomodoro timer, and returns any streak unlocks.
 */
export async function handleAnswer(visitId: string, answer: Answer): Promise<AnswerOutcome> {
  const visit = await takeVisit(visitId);
  if (!visit) return { unlocks: [] }; // stale or duplicate
  let unlocks: AnswerOutcome['unlocks'] = [];
  switch (visit.kind) {
    case 'reminder':
    case 'lesson':
      if (visit.modes.length === 0) break; // a Pomodoro break with nothing bundled
      for (const mode of visit.modes) await recordAnswer(mode, answer);
      await rescheduleModes(visit.modes, answer === 'snooze' ? SNOOZE_MIN : undefined);
      // One visit = one affection change, however many modes it bundled.
      unlocks = await applyBondAnswer(visit.characterId, answer);
      // The overlay celebrates them right away; notifications leave them for
      // the next on-page visit.
      if (visit.channel === 'overlay') await markAnnounced(visit.characterId, unlocks);
      break;
    case 'pomodoroEnd':
      await handlePomodoroAnswer(answer);
      break;
    case 'reaction':
      break; // reactions are just for fun: no stats, no affection
  }
  if (visit.channel === 'notification') await clearNotification(visitId);
  return { unlocks };
}

/** No answer arrived in time. */
export async function handleVisitTimeout(): Promise<void> {
  const { activeVisit } = await getItem('schedule');
  if (!activeVisit) return;
  if (activeVisit.channel === 'notification') {
    // Left unanswered for a minute: the same as an ignored bubble.
    await handleAnswer(activeVisit.id, 'ignored');
    return;
  }
  // The tab was closed or navigated mid-visit. Not the user's choice, so no
  // stats; just come back a bit later.
  const visit = await takeVisit(activeVisit.id);
  if (!visit) return;
  if (visit.kind === 'pomodoroEnd') await handlePomodoroAnswer('snooze');
  else await rescheduleModes(visit.modes, SNOOZE_MIN);
}
