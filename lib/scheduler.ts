/**
 * Reminder scheduler. Runs in the service worker.
 *
 * Chrome may stop the service worker at any moment, so nothing here keeps
 * state in memory: due times live in storage (`schedule`) and wake-ups are
 * chrome.alarms. Each scheduled mode owns one alarm named `mode:<id>`.
 */
import { sendToTab } from '@/lib/messaging';
import { effectiveIntervalMin, MODE_IDS, SCHEDULED_MODES, SNOOZE_MIN } from '@/lib/modes';
import { recordAnswer } from '@/lib/stats';
import { getItem, updateItem } from '@/lib/storage';
import type { ActiveVisit, Answer, MessageResponses, ModeId, Visit } from '@/utils/types';

const MINUTE = 60_000;
const MODE_ALARM_PREFIX = 'mode:';
const VISIT_TIMEOUT_ALARM = 'visit:timeout';
/** When a reminder can't be shown right now, try again after this long. */
const RETRY_MIN = 1;
/**
 * A visit takes at most ~75 s (walk in, 60 s bubble, reaction, walk out).
 * If no answer arrived by then the tab was closed or navigated: the visit is lost.
 */
const VISIT_TIMEOUT_MIN = 2;

function modeAlarmName(mode: ModeId): string {
  return `${MODE_ALARM_PREFIX}${mode}`;
}

function modeFromAlarm(name: string): ModeId | null {
  if (!name.startsWith(MODE_ALARM_PREFIX)) return null;
  const id = name.slice(MODE_ALARM_PREFIX.length);
  return MODE_IDS.find((mode) => mode === id) ?? null;
}

function isStale(visit: ActiveVisit, now: number): boolean {
  return now - visit.shownAt > VISIT_TIMEOUT_MIN * MINUTE;
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
        modes[mode] = { nextDueAt: now + interval * MINUTE, intervalMin: interval };
      }
    }
    const visit = current.activeVisit;
    const keepVisit = settings.enabled && visit !== null && !isStale(visit, now);
    return { modes, activeVisit: keepVisit ? visit : null };
  });

  if (!schedule.activeVisit) await chrome.alarms.clear(VISIT_TIMEOUT_ALARM);

  for (const mode of MODE_IDS) {
    const name = modeAlarmName(mode);
    const entry = schedule.modes[mode];
    if (!entry) {
      await chrome.alarms.clear(name);
      continue;
    }
    const alarm = await chrome.alarms.get(name);
    if (!alarm || Math.abs(alarm.scheduledTime - entry.nextDueAt) > 1000) {
      // A due time in the past (e.g. after a browser restart) fires right away.
      await chrome.alarms.create(name, { when: Math.max(entry.nextDueAt, now + 1000) });
    }
  }
}

async function retryLater(mode: ModeId): Promise<void> {
  await chrome.alarms.create(modeAlarmName(mode), { delayInMinutes: RETRY_MIN });
}

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name === VISIT_TIMEOUT_ALARM) {
    await handleVisitTimeout();
    return;
  }
  const mode = modeFromAlarm(alarm.name);
  if (!mode) return;

  const [settings, schedule] = await Promise.all([getItem('settings'), getItem('schedule')]);
  if (!settings.enabled || !schedule.modes[mode]) return;

  // One visit at a time. The timeout alarm guarantees activeVisit is cleared.
  if (schedule.activeVisit) {
    await retryLater(mode);
    return;
  }
  const result = await showVisit([mode]);
  if (!result.ok) await retryLater(mode);
}

/**
 * Ask the active tab of the focused window to play a visit.
 * Fails when that tab cannot run content scripts (chrome:// pages etc.).
 */
export async function showVisit(modes: ModeId[]): Promise<MessageResponses['debug/visitNow']> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id === undefined) return { ok: false, reason: 'No active tab.' };
  const tabId = tab.id;

  const characters = await getItem('characters');
  const visit: Visit = { id: crypto.randomUUID(), kind: 'reminder', modes, characterId: characters.activeId };

  // Claim the slot before sending so a second alarm firing meanwhile waits.
  await updateItem('schedule', (s) => ({
    ...s,
    activeVisit: { id: visit.id, tabId, modes, shownAt: Date.now() },
  }));
  try {
    await sendToTab(tabId, { type: 'visit/show', visit });
  } catch {
    await updateItem('schedule', (s) => ({ ...s, activeVisit: null }));
    return { ok: false, reason: 'This page cannot show the buddy. Try a normal website.' };
  }
  await chrome.alarms.create(VISIT_TIMEOUT_ALARM, { delayInMinutes: VISIT_TIMEOUT_MIN });
  return { ok: true };
}

/** Clear the active visit and schedule each of its modes again. */
async function finishVisit(modes: ModeId[], delayOverrideMin?: number): Promise<void> {
  const settings = await getItem('settings');
  const now = Date.now();
  const schedule = await updateItem('schedule', (s) => {
    const next = { ...s.modes };
    for (const mode of modes) {
      const entry = next[mode];
      if (!entry) continue; // e.g. a debug visit for a mode that is switched off
      const delay = delayOverrideMin ?? effectiveIntervalMin(settings, mode);
      next[mode] = { ...entry, nextDueAt: now + delay * MINUTE };
    }
    return { modes: next, activeVisit: null };
  });
  await chrome.alarms.clear(VISIT_TIMEOUT_ALARM);
  for (const mode of modes) {
    const entry = schedule.modes[mode];
    if (entry) await chrome.alarms.create(modeAlarmName(mode), { when: entry.nextDueAt });
  }
}

export async function handleAnswer(visitId: string, answer: Answer): Promise<void> {
  const { activeVisit } = await getItem('schedule');
  if (!activeVisit || activeVisit.id !== visitId) return; // stale or duplicate
  for (const mode of activeVisit.modes) await recordAnswer(mode, answer);
  await finishVisit(activeVisit.modes, answer === 'snooze' ? SNOOZE_MIN : undefined);
}

/** The visit vanished without an answer (tab closed, page navigated). */
async function handleVisitTimeout(): Promise<void> {
  const { activeVisit } = await getItem('schedule');
  if (!activeVisit) return;
  // Not the user's choice, so no stats; just come back a bit later.
  await finishVisit(activeVisit.modes, SNOOZE_MIN);
}
