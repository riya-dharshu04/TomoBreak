/**
 * Decides when and where the buddy appears ("never breaks your flow").
 *
 * tryDeliver() is called on every event that might be a good moment: a mode
 * becoming due, page activity, tab switches, navigation, returning to Chrome
 * or from idle, and the periodic alarms. It picks at most one thing to show,
 * in this order, or does nothing and waits for the next call:
 *
 *   1. Pomodoro break / break-over visit. Time-sensitive: skips the pause,
 *      gap and quiet-hour rules; falls back to a notification right away.
 *   2. While a Pomodoro focus session runs, everything else waits and is
 *      bundled into the break visit.
 *   3. Due reminders, merged into one visit (Entertainment goes on its own):
 *      - quiet hours → postponed to their end
 *      - < 5 min since the last visit, idle/locked, or just back → wait
 *      - natural pause (no typing for 20 s, tab switch, navigation, return)
 *        or 10 min overdue (gentle peek) → show
 *      - fullscreen or in a call → wait; restricted page → notification;
 *        other app focused / blocked site → notification once overdue
 *      - the page itself refuses while the user types in a text field
 *   4. A pending context reaction: same rules, but only at a natural pause,
 *      only on the page (never a notification), max one per 15 minutes.
 */
import { markAnnounced, markSummaryShown, bondFor, moodFor, pendingWeeklySummary, summarizeDays, unannounced } from '@/lib/bond';
import {
  type FocusTrigger,
  type IdleState,
  IDLE_DETECTION_S,
  consumeReturn,
  focusTiming,
  getFocus,
  hostMatches,
  isInQuietHours,
  isNaturalPause,
  isRestrictedUrl,
  isSettlingAfterReturn,
  quietHoursEnd,
  recordActivity,
  recordIdleState,
} from '@/lib/focus';
import { sendToTab } from '@/lib/messaging';
import { showNotification } from '@/lib/notify';
import { POMODORO_ALARM, clearPendingPomodoroVisit, handlePomodoroAlarm } from '@/lib/pomodoro';
import {
  REACTION_TICK_ALARM,
  clearPendingReaction,
  isReactionEnabled,
  markReactionShown,
  mayShowReaction,
  reactionTiming,
  resetLongSession,
  tickReactions,
} from '@/lib/reactions';
import {
  CHECK_ALARM,
  VISIT_TIMEOUT_ALARM,
  claimVisit,
  deferModes,
  handleVisitTimeout,
  markDue,
  modeFromAlarm,
  pendingModes,
  releaseVisit,
  startVisitTimeout,
  type PendingSet,
} from '@/lib/scheduler';
import { getItem } from '@/lib/storage';
import type {
  AdapterEvent,
  UnlockId,
  DebugScenario,
  MessageResponses,
  ModeId,
  Settings,
  Visit,
  VisitBody,
  VisitChannel,
  VisitEntrance,
} from '@/utils/types';

type Target =
  | { kind: 'page'; tabId: number }
  /** The active tab can never run the overlay: use a notification. */
  | { kind: 'notify' }
  /** The overlay isn't possible right now (other app, blocked site). */
  | { kind: 'away' }
  /** Fullscreen or in a call: don't interrupt at all. */
  | { kind: 'busy' };

type PageResult = 'shown' | 'refused' | 'unreachable';

// ---- Event entry points -------------------------------------------------------

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  switch (alarm.name) {
    case VISIT_TIMEOUT_ALARM:
      await handleVisitTimeout();
      return;
    case CHECK_ALARM:
      await tryDeliver('check');
      return;
    case POMODORO_ALARM:
      await handlePomodoroAlarm();
      await tryDeliver('due');
      return;
    case REACTION_TICK_ALARM:
      await tickReactions();
      await tryDeliver('check');
      return;
  }
  const mode = modeFromAlarm(alarm.name);
  if (!mode) return;
  await markDue(mode);
  await tryDeliver('due');
}

export async function handleActivity(typing: boolean, sender: chrome.runtime.MessageSender): Promise<void> {
  // Only the tab the user is looking at says anything about their focus.
  if (!sender.tab?.active) return;
  await recordActivity(typing);
  await tryDeliver('activity');
}

export async function handleIdleState(state: IdleState): Promise<void> {
  const awayMs = await recordIdleState(state);
  if (state !== 'active') return;
  const settings = await getItem('settings');
  if (awayMs >= reactionTiming(settings).breakMs) await resetLongSession();
  await tryDeliver('return');
}

/** A site adapter saw a coding result on the page: celebrate right there. */
export async function handleAdapterEvent(event: AdapterEvent, sender: chrome.runtime.MessageSender): Promise<void> {
  const tabId = sender.tab?.id;
  if (tabId === undefined || !sender.tab?.active) return;
  const [settings, schedule, pomodoro, reactions] = await Promise.all([
    getItem('settings'),
    getItem('schedule'),
    getItem('pomodoro'),
    getItem('reactions'),
  ]);
  const now = Date.now();
  if (schedule.activeVisit || pomodoro.phase === 'focus') return;
  if (!mayShowReaction(settings, reactions, event, now)) return;
  if (isInQuietHours(settings.quietHours, now)) return;
  if (now - schedule.lastVisitEndAt < focusTiming(settings).minGapMs) return;
  if ((await showOnPage(tabId, { kind: 'reaction', reaction: event }, 'walk')) === 'shown') {
    await markReactionShown(now);
  }
}

// ---- The decision ---------------------------------------------------------------

export async function tryDeliver(trigger: FocusTrigger): Promise<void> {
  const [settings, schedule, pomodoro, reactions] = await Promise.all([
    getItem('settings'),
    getItem('schedule'),
    getItem('pomodoro'),
    getItem('reactions'),
  ]);
  if (!settings.enabled || schedule.activeVisit) return;
  const pending = pendingModes(schedule);

  if (pomodoro.pendingVisit) {
    await deliverPomodoro(settings, pomodoro.pendingVisit, pending);
    return;
  }
  if (pomodoro.phase === 'focus') return;
  if (!pending && !reactions.pending) return;

  const now = Date.now();
  const timing = focusTiming(settings);
  if (isInQuietHours(settings.quietHours, now)) {
    if (pending) await deferModes(pending.modes, quietHoursEnd(settings.quietHours, now));
    if (reactions.pending) await clearPendingReaction();
    return;
  }
  if (now - schedule.lastVisitEndAt < timing.minGapMs) return;
  // Away from the computer: wait, however overdue, until they're back.
  if ((await chrome.idle.queryState(IDLE_DETECTION_S)) !== 'active') return;
  const focus = await getFocus();
  if (isSettlingAfterReturn(focus, timing, now)) return;
  const paused = isNaturalPause(trigger, focus, timing, now);

  if (pending) {
    await deliverReminders(settings, pending, paused, now - pending.oldest >= timing.maxDelayMs);
    return;
  }
  if (reactions.pending) {
    const { kind, since } = reactions.pending;
    // Too old to be relevant, or switched off meanwhile.
    if (now - since >= reactionTiming(settings).staleMs || !isReactionEnabled(settings, kind)) {
      await clearPendingReaction();
      return;
    }
    if (!paused || !mayShowReaction(settings, reactions, kind, now)) return;
    const target = await findTarget(settings);
    if (target.kind !== 'page') return;
    if ((await showOnPage(target.tabId, { kind: 'reaction', reaction: kind }, 'walk')) === 'shown') {
      await markReactionShown(now);
    }
  }
}

/** Wellness reminders merge into one visit; Entertainment only comes alone. */
function reminderModes(pending: PendingSet): ModeId[] {
  const wellness = pending.modes.filter((mode) => mode !== 'entertainment');
  return wellness.length > 0 ? wellness : pending.modes;
}

async function deliverReminders(settings: Settings, pending: PendingSet, paused: boolean, overdue: boolean): Promise<void> {
  if (!paused && !overdue) return;
  const body: VisitBody = { kind: 'reminder', modes: reminderModes(pending), pomodoroBreakMin: null };
  const target = await findTarget(settings);
  switch (target.kind) {
    case 'busy':
      return;
    case 'away':
      if (overdue) await showAsNotification(body);
      return;
    case 'notify':
      await showAsNotification(body);
      return;
    case 'page': {
      // Forced by the time limit rather than a pause: peek in gently.
      const result = await showOnPage(target.tabId, body, paused ? 'walk' : 'peek');
      // Unreachable = no content script yet (tab opened before install, page
      // still loading). Retry later, or fall back once overdue.
      if (result === 'unreachable' && overdue) await showAsNotification(body);
      return;
    }
  }
}

async function deliverPomodoro(settings: Settings, which: 'break' | 'end', pending: PendingSet | null): Promise<void> {
  if ((await chrome.idle.queryState(IDLE_DETECTION_S)) !== 'active') return;
  const body: VisitBody =
    which === 'break'
      ? {
          kind: 'reminder',
          // Everything held back during focus, delivered with the break.
          modes: pending ? pending.modes.filter((mode) => mode !== 'entertainment') : [],
          pomodoroBreakMin: settings.debugFastIntervals ? 1 : settings.pomodoroBreakMin,
        }
      : { kind: 'pomodoroEnd' };
  const target = await findTarget(settings);
  let shown = false;
  if (target.kind === 'busy') return;
  if (target.kind === 'page') {
    const result = await showOnPage(target.tabId, body, 'walk');
    if (result === 'refused') return; // typing: retry within 30 s
    shown = result === 'shown' || (await showAsNotification(body));
  } else {
    shown = await showAsNotification(body);
  }
  if (shown) await clearPendingPomodoroVisit();
}

// ---- Where to show ----------------------------------------------------------------

async function findTarget(settings: Settings): Promise<Target> {
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  // Chrome isn't the focused app (or only DevTools/popups are).
  if (!win?.focused || win.id === undefined) return { kind: 'away' };
  // Window fullscreen covers videos and presentations as well as F11.
  if (win.state === 'fullscreen') return { kind: 'busy' };
  if (await isInCall(settings.meetingSites)) return { kind: 'busy' };

  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  const url = tab?.url || tab?.pendingUrl || '';
  if (tab?.id === undefined || url === '') return { kind: 'away' };
  if (hostMatches(url, settings.meetingSites)) return { kind: 'busy' };
  if (hostMatches(url, settings.blockedSites)) return { kind: 'away' };
  // Our own options page: the user is busy setting things up right here.
  if (url.startsWith(chrome.runtime.getURL('/'))) return { kind: 'away' };
  if (isRestrictedUrl(url)) return { kind: 'notify' };
  return { kind: 'page', tabId: tab.id };
}

/** A meeting site playing audio in any tab means the user is probably on a call. */
async function isInCall(meetingSites: readonly string[]): Promise<boolean> {
  const audible = await chrome.tabs.query({ audible: true });
  return audible.some((tab) => tab.url !== undefined && hostMatches(tab.url, meetingSites));
}

// ---- Showing ------------------------------------------------------------------------

interface BuiltVisit {
  visit: Visit;
  /** Week whose summary this visit presents, to mark once shown. */
  summaryWeek: string | null;
  /** Unlock celebrations to mark as played once shown. */
  announced: UnlockId[];
}

async function buildVisit(body: VisitBody, entrance: VisitEntrance, channel: VisitChannel): Promise<BuiltVisit> {
  const [characters, bondStore] = await Promise.all([getItem('characters'), getItem('bond')]);
  const bond = bondFor(bondStore, characters.activeId);
  // Cards and unlock celebrations need the overlay; notifications skip them.
  const weekly = channel === 'overlay' ? await pendingWeeklySummary() : null;
  const visit: Visit = {
    ...body,
    id: crypto.randomUUID(),
    characterId: characters.activeId,
    entrance,
    preview: false,
    mood: moodFor(bond.affection),
    unlocks: bond.unlocks,
    announce: channel === 'overlay' ? unannounced(bond) : [],
    summary: weekly?.summary ?? null,
  };
  return { visit, summaryWeek: weekly?.week ?? null, announced: visit.announce };
}

function activeVisitFor(visit: Visit, channel: VisitChannel, tabId: number | null): Parameters<typeof claimVisit>[0] {
  return {
    id: visit.id,
    kind: visit.kind,
    channel,
    tabId,
    modes: visit.kind === 'reminder' ? visit.modes : [],
    characterId: visit.characterId,
    shownAt: Date.now(),
  };
}

/** Bookkeeping once a visit really appeared. */
async function afterShown({ visit, summaryWeek, announced }: BuiltVisit): Promise<void> {
  await consumeReturn();
  if (summaryWeek !== null) await markSummaryShown(summaryWeek);
  await markAnnounced(visit.characterId, announced);
}

async function showOnPage(tabId: number, body: VisitBody, entrance: VisitEntrance, extras?: Partial<Visit>): Promise<PageResult> {
  let built = await buildVisit(body, entrance, 'overlay');
  // Debug demos replace the card/celebrations; don't mark the real ones as done.
  if (extras) built = { visit: { ...built.visit, ...extras } as Visit, summaryWeek: null, announced: [] };
  const { visit } = built;
  // Claim the slot before sending so a second trigger meanwhile waits.
  if (!(await claimVisit(activeVisitFor(visit, 'overlay', tabId)))) return 'refused';
  let result: MessageResponses['visit/show'] | undefined;
  try {
    result = await sendToTab(tabId, { type: 'visit/show', visit });
  } catch {
    result = undefined;
  }
  if (!result?.ok) {
    await releaseVisit(visit.id);
    return result ? 'refused' : 'unreachable';
  }
  await startVisitTimeout('overlay');
  await afterShown(built);
  return 'shown';
}

async function showAsNotification(body: VisitBody): Promise<boolean> {
  const built = await buildVisit(body, 'walk', 'notification');
  const { visit } = built;
  if (!(await claimVisit(activeVisitFor(visit, 'notification', null)))) return false;
  if (!(await showNotification(visit))) {
    await releaseVisit(visit.id);
    return false;
  }
  await startVisitTimeout('notification');
  await afterShown(built);
  return true;
}

// ---- Debug ---------------------------------------------------------------------------

/** Popup debug panel: show a scenario now, skipping every timing rule. */
export async function showDebug(scenario: DebugScenario): Promise<MessageResponses['debug/visitNow']> {
  const { activeVisit } = await getItem('schedule');
  if (activeVisit) return { ok: false, reason: 'Your buddy is already visiting.' };

  let body: VisitBody = { kind: 'reminder', modes: ['hydration'], pomodoroBreakMin: null };
  let extras: Partial<Visit> | undefined;
  switch (scenario.type) {
    case 'mode':
      body = { kind: 'reminder', modes: [scenario.mode], pomodoroBreakMin: null };
      break;
    case 'merged':
      body = { kind: 'reminder', modes: ['hydration', 'stretch'], pomodoroBreakMin: null };
      break;
    case 'pomodoroBreak':
      body = { kind: 'reminder', modes: ['hydration', 'posture'], pomodoroBreakMin: 5 };
      break;
    case 'pomodoroEnd':
      body = { kind: 'pomodoroEnd' };
      break;
    case 'reaction':
      body = { kind: 'reaction', reaction: scenario.reaction };
      break;
    case 'summary': {
      // Last 7 days of real stats, so it works before a week has passed.
      const summary = summarizeDays(await getItem('stats'), new Date(Date.now() + 86_400_000));
      extras = { summary: summary.total > 0 ? summary : { counts: { hydration: 1 }, total: 1 } };
      break;
    }
    case 'unlock':
      extras = { announce: ['dance', 'outfit'] };
      break;
  }

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id !== undefined && tab.url !== undefined && !isRestrictedUrl(tab.url)) {
    const result = await showOnPage(tab.id, body, 'walk', extras);
    if (result === 'shown') return { ok: true };
    if (result === 'refused') return { ok: false, reason: 'The page is busy (typing or fullscreen).' };
  }
  if (body.kind === 'reaction') return { ok: false, reason: 'Reactions only appear on normal web pages.' };
  const notified = await showAsNotification(body);
  return notified
    ? { ok: true, reason: 'This page cannot show the buddy, so a notification was sent.' }
    : { ok: false, reason: 'Could not show a notification.' };
}
