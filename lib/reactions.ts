/**
 * Context reactions: the buddy notices what you're doing.
 *
 * A once-a-minute `reactions:tick` alarm checks the time-based ones (late
 * night, long session, social sites); tab count is checked when tabs open;
 * coding wins come from site adapters in the content script. Detected
 * reactions wait in `reactions.pending` for a natural pause, like reminders
 * (lib/delivery.ts), and at most one appears every 15 minutes.
 *
 * Only URLs of the active tab (already visible to the `tabs` permission) and
 * idle state are used; nothing is recorded beyond the timestamps below.
 */
import { IDLE_DETECTION_S, hostMatches } from '@/lib/focus';
import { dayKey } from '@/lib/stats';
import { getItem, updateItem } from '@/lib/storage';
import type { ReactionId, ReactionKind, ReactionState, Settings } from '@/utils/types';

const MINUTE = 60_000;
export const REACTION_TICK_ALARM = 'reactions:tick';
const TAB_LIMIT = 25;
/** Late-night reactions stop at 5 AM. */
const LATE_NIGHT_END_MIN = 5 * 60;

export interface ReactionTiming {
  /** At most one reaction per this long. */
  gapMs: number;
  /** Continuous activity before suggesting a stretch. */
  longSessionMs: number;
  /** An idle stretch at least this long counts as a real break. */
  breakMs: number;
  /** Time on a social site before the playful nudge. */
  socialMs: number;
  tabCooldownMs: number;
  /** A pending reaction older than this is no longer relevant. */
  staleMs: number;
}

export function reactionTiming(settings: Settings): ReactionTiming {
  // The debug switch makes every reaction testable within a few minutes.
  const debug = settings.debugFastIntervals;
  return {
    gapMs: (debug ? 1 : 15) * MINUTE,
    longSessionMs: (debug ? 3 : 120) * MINUTE,
    breakMs: (debug ? 1 : 5) * MINUTE,
    socialMs: (debug ? 2 : 30) * MINUTE,
    tabCooldownMs: (debug ? 2 : 120) * MINUTE,
    staleMs: 20 * MINUTE,
  };
}

const TOGGLE_FOR: Record<ReactionKind, ReactionId> = {
  lateNight: 'lateNight',
  longSession: 'longSession',
  tabOverload: 'tabOverload',
  codingWin: 'codingWins',
  codingFail: 'codingWins',
  socialNudge: 'socialNudge',
};

export function isReactionEnabled(settings: Settings, kind: ReactionKind): boolean {
  return settings.enabled && settings.reactions[TOGGLE_FOR[kind]];
}

export async function ensureReactionAlarm(): Promise<void> {
  if (!(await chrome.alarms.get(REACTION_TICK_ALARM))) {
    await chrome.alarms.create(REACTION_TICK_ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
  }
}

function canQueue(state: ReactionState, timing: ReactionTiming, now: number): boolean {
  const pendingFresh = state.pending !== null && now - state.pending.since < timing.staleMs;
  return !pendingFresh && now - state.lastReactionAt >= timing.gapMs;
}

/** The evening a late night belongs to, so 1 AM and 3 AM count as the same night. */
function nightKey(now: number): string {
  return dayKey(new Date(now - 12 * 60 * MINUTE));
}

function isLateNight(settings: Settings, now: number): boolean {
  const date = new Date(now);
  const minute = date.getHours() * 60 + date.getMinutes();
  const start = settings.lateNightStartMin;
  return start < LATE_NIGHT_END_MIN
    ? minute >= start && minute < LATE_NIGHT_END_MIN
    : minute >= start || minute < LATE_NIGHT_END_MIN; // starts before midnight
}

async function activeTabUrl(): Promise<string | null> {
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  if (!win?.focused || win.id === undefined) return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  return tab?.url ?? null;
}

/** Periodic check for the time-based reactions. */
export async function tickReactions(): Promise<void> {
  const settings = await getItem('settings');
  if (!settings.enabled) return;
  const now = Date.now();
  const timing = reactionTiming(settings);
  const present = (await chrome.idle.queryState(IDLE_DETECTION_S)) === 'active';
  const url = present ? await activeTabUrl() : null;
  const onSocial = url !== null && hostMatches(url, settings.socialSites);

  await updateItem('reactions', (state) => {
    const next: ReactionState = { ...state };
    // Session and social clocks run only while the user is here.
    if (present && next.activeSince === null) next.activeSince = now;
    next.socialSince = onSocial ? (next.socialSince ?? now) : null;

    const queue = (kind: ReactionKind): void => {
      if (isReactionEnabled(settings, kind) && canQueue(next, timing, now)) next.pending = { kind, since: now };
    };

    if (present && isLateNight(settings, now) && next.lastLateNight !== nightKey(now)) {
      next.lastLateNight = nightKey(now);
      queue('lateNight');
    }
    if (next.activeSince !== null && now - next.activeSince >= timing.longSessionMs) {
      next.activeSince = now; // next suggestion after another full session
      queue('longSession');
    }
    if (next.socialSince !== null && now - next.socialSince >= timing.socialMs) {
      next.socialSince = now;
      queue('socialNudge');
    }
    // Unchanged → return the same object so no storage write happens.
    return JSON.stringify(next) === JSON.stringify(state) ? state : next;
  });
}

/** The user was away long enough for it to count as a break. */
export async function resetLongSession(): Promise<void> {
  await updateItem('reactions', (state) => ({ ...state, activeSince: null }));
}

/** Called when a tab opens. */
export async function checkTabOverload(): Promise<void> {
  const settings = await getItem('settings');
  if (!isReactionEnabled(settings, 'tabOverload')) return;
  const tabs = await chrome.tabs.query({});
  if (tabs.length <= TAB_LIMIT) return;
  const now = Date.now();
  const timing = reactionTiming(settings);
  await updateItem('reactions', (state) => {
    if (now - state.lastTabOverloadAt < timing.tabCooldownMs || !canQueue(state, timing, now)) return state;
    return { ...state, lastTabOverloadAt: now, pending: { kind: 'tabOverload', since: now } };
  });
}

/** Whether a reaction may appear now (15-minute rule, toggles). */
export function mayShowReaction(settings: Settings, state: ReactionState, kind: ReactionKind, now: number): boolean {
  return isReactionEnabled(settings, kind) && now - state.lastReactionAt >= reactionTiming(settings).gapMs;
}

export async function clearPendingReaction(): Promise<void> {
  await updateItem('reactions', (state) => (state.pending ? { ...state, pending: null } : state));
}

export async function markReactionShown(now = Date.now()): Promise<void> {
  await updateItem('reactions', (state) => ({ ...state, lastReactionAt: now, pending: null }));
}
