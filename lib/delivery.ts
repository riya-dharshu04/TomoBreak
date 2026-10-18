/**
 * Decides when and where a pending reminder appears ("never breaks your flow").
 *
 * tryDeliver() is called on every event that might be a good moment: a mode
 * becoming due, page activity, tab switches, navigation, returning to Chrome
 * or from idle, and a 30 s check alarm. It walks through the rules below and
 * either shows one visit for all pending modes or does nothing and waits for
 * the next call. All inputs come from storage, alarms and Chrome APIs.
 *
 *   1. Quiet hours        → postpone to the end of quiet hours.
 *   2. < 5 min since last → wait.
 *   3. Idle / locked      → wait; after returning, wait ~5 s more.
 *   4. Natural pause (no typing for 20 s, tab switch, navigation, return) or
 *      overdue by 10 min → continue, else wait.
 *   5. Where: fullscreen or in a call → wait. Restricted page → notification.
 *      Another app focused / blocked site → notification once overdue.
 *      Otherwise the page, which may still refuse while the user types.
 */
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
} from '@/lib/scheduler';
import { getItem } from '@/lib/storage';
import type { MessageResponses, ModeId, Settings, Visit, VisitEntrance } from '@/utils/types';

type Target =
  | { kind: 'page'; tabId: number }
  /** The active tab can never run the overlay: use a notification. */
  | { kind: 'notify' }
  /** The overlay isn't possible right now (other app, blocked site). */
  | { kind: 'away' }
  /** Fullscreen or in a call: don't interrupt at all. */
  | { kind: 'busy' };

type PageResult = 'shown' | 'refused' | 'unreachable';

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name === VISIT_TIMEOUT_ALARM) {
    await handleVisitTimeout();
    return;
  }
  if (alarm.name === CHECK_ALARM) {
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
  await recordIdleState(state);
  if (state === 'active') await tryDeliver('return');
}

export async function tryDeliver(trigger: FocusTrigger): Promise<void> {
  const [settings, schedule] = await Promise.all([getItem('settings'), getItem('schedule')]);
  const pending = pendingModes(schedule);
  if (!settings.enabled || !pending || schedule.activeVisit) return;

  const now = Date.now();
  const timing = focusTiming(settings);

  if (isInQuietHours(settings.quietHours, now)) {
    await deferModes(pending.modes, quietHoursEnd(settings.quietHours, now));
    return;
  }
  if (now - schedule.lastVisitEndAt < timing.minGapMs) return;
  // Away from the computer: the reminder waits, however overdue, until they're back.
  if ((await chrome.idle.queryState(IDLE_DETECTION_S)) !== 'active') return;
  const focus = await getFocus();
  if (isSettlingAfterReturn(focus, timing, now)) return;

  const paused = isNaturalPause(trigger, focus, timing, now);
  const overdue = now - pending.oldest >= timing.maxDelayMs;
  if (!paused && !overdue) return;

  const target = await findTarget(settings);
  switch (target.kind) {
    case 'busy':
      return;
    case 'away':
      if (overdue) await showAsNotification(pending.modes);
      return;
    case 'notify':
      await showAsNotification(pending.modes);
      return;
    case 'page': {
      // Forced by the time limit rather than a pause: peek in gently.
      const result = await showOnPage(target.tabId, pending.modes, paused ? 'walk' : 'peek');
      // Unreachable = no content script yet (tab opened before install, page
      // still loading). Retry later, or fall back once overdue.
      if (result === 'unreachable' && overdue) await showAsNotification(pending.modes);
      return;
    }
  }
}

/** Debug "Visit now": skip every timing rule and show a Hydration visit. */
export async function showNow(): Promise<MessageResponses['debug/visitNow']> {
  const { activeVisit } = await getItem('schedule');
  if (activeVisit) return { ok: false, reason: 'Your buddy is already visiting.' };
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const modes: ModeId[] = ['hydration'];
  if (tab?.id !== undefined && tab.url !== undefined && !isRestrictedUrl(tab.url)) {
    const result = await showOnPage(tab.id, modes, 'walk');
    if (result === 'shown') return { ok: true };
    if (result === 'refused') return { ok: false, reason: 'The page is busy (typing or fullscreen).' };
  }
  const notified = await showAsNotification(modes);
  return notified
    ? { ok: true, reason: 'This page cannot show the buddy, so a notification was sent.' }
    : { ok: false, reason: 'Could not show a notification.' };
}

// ---- Where to show ----------------------------------------------------------

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

// ---- Showing ----------------------------------------------------------------

async function newVisit(modes: ModeId[], entrance: VisitEntrance): Promise<Visit> {
  const characters = await getItem('characters');
  return { id: crypto.randomUUID(), kind: 'reminder', modes, characterId: characters.activeId, entrance };
}

async function showOnPage(tabId: number, modes: ModeId[], entrance: VisitEntrance): Promise<PageResult> {
  const visit = await newVisit(modes, entrance);
  // Claim the slot before sending so a second trigger meanwhile waits.
  if (!(await claimVisit({ id: visit.id, channel: 'overlay', tabId, modes, shownAt: Date.now() }))) {
    return 'refused';
  }
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
  await consumeReturn();
  return 'shown';
}

async function showAsNotification(modes: ModeId[]): Promise<boolean> {
  const visit = await newVisit(modes, 'walk');
  if (!(await claimVisit({ id: visit.id, channel: 'notification', tabId: null, modes, shownAt: Date.now() }))) {
    return false;
  }
  if (!(await showNotification(visit))) {
    await releaseVisit(visit.id);
    return false;
  }
  await startVisitTimeout('notification');
  await consumeReturn();
  return true;
}
