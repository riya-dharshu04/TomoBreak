/**
 * Focus-aware timing: the rules for *when* a due reminder may appear.
 *
 * Recent activity lives in chrome.storage.session (times only), so it
 * survives the service worker being stopped but not a browser restart.
 * The functions below are small and mostly pure; lib/delivery.ts combines
 * them into the actual decision.
 */
import type { FocusState, QuietHours, SessionSchema, Settings } from '@/utils/types';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

/** What woke the delivery check. Some of these are natural pauses by themselves. */
export type FocusTrigger =
  | 'due' // a mode alarm fired
  | 'check' // periodic re-check while something is pending
  | 'activity' // the page reported activity
  | 'tabSwitch'
  | 'navigation'
  | 'windowFocus' // the user came back to Chrome from another app
  | 'return'; // chrome.idle: back from idle / lock screen

/** What chrome.idle reports (its enum type does not accept the plain strings). */
export type IdleState = 'active' | 'idle' | 'locked';

const PAUSE_TRIGGERS: ReadonlySet<FocusTrigger> = new Set(['tabSwitch', 'navigation', 'windowFocus']);

export interface FocusTiming {
  /** No typing for this long while present = natural pause. */
  typingPauseMs: number;
  /** Wait this long after the user returns from idle before showing. */
  returnDelayMs: number;
  /** A return from idle stays a "pause" for this long. */
  returnWindowMs: number;
  /** Show anyway (gently) this long after the due time. */
  maxDelayMs: number;
  /** Minimum time between two visits. */
  minGapMs: number;
}

export function focusTiming(settings: Settings): FocusTiming {
  // The hidden debug switch shortens the waits so the flow can be tested quickly.
  const debug = settings.debugFastIntervals;
  return {
    typingPauseMs: 20 * SECOND,
    returnDelayMs: 5 * SECOND,
    returnWindowMs: 2 * MINUTE,
    maxDelayMs: debug ? 2 * MINUTE : 10 * MINUTE,
    minGapMs: debug ? 1 * MINUTE : 5 * MINUTE,
  };
}

/** chrome.idle reports "idle" after this many seconds without input. */
export const IDLE_DETECTION_S = 60;

// ---- Session state ----------------------------------------------------------

function defaultFocus(): FocusState {
  return { lastActivityAt: 0, lastTypingAt: 0, returnedAt: null, idleSince: null };
}

export async function getFocus(): Promise<FocusState> {
  const result = (await chrome.storage.session.get('focus')) as Partial<SessionSchema>;
  return { ...defaultFocus(), ...result.focus };
}

/** Serialised read-modify-write, like updateItem in lib/storage.ts. */
let queue: Promise<unknown> = Promise.resolve();
export function updateFocus(update: (current: FocusState) => FocusState): Promise<FocusState> {
  const run = async (): Promise<FocusState> => {
    const next = update(await getFocus());
    const value: SessionSchema = { focus: next };
    await chrome.storage.session.set(value);
    return next;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

export function recordActivity(typing: boolean, now = Date.now()): Promise<FocusState> {
  return updateFocus((focus) => ({
    ...focus,
    lastActivityAt: now,
    lastTypingAt: typing ? now : focus.lastTypingAt,
  }));
}

/**
 * Track idle transitions. Returns how long the user was away when they come
 * back (0 otherwise), so a long absence can count as a break.
 */
export async function recordIdleState(state: IdleState, now = Date.now()): Promise<number> {
  const result = { awayMs: 0 };
  await updateFocus((focus) => {
    if (state !== 'active') return { ...focus, returnedAt: null, idleSince: focus.idleSince ?? now };
    result.awayMs = focus.idleSince === null ? 0 : now - focus.idleSince;
    // Leaving idle starts the "show ~5 s after they return" window.
    return { ...focus, returnedAt: now, idleSince: null };
  });
  return result.awayMs;
}

/** A visit used up the return-from-idle pause. */
export function consumeReturn(): Promise<FocusState> {
  return updateFocus((focus) => ({ ...focus, returnedAt: null }));
}

// ---- Rules ------------------------------------------------------------------

/** True while we must wait a little after the user came back. */
export function isSettlingAfterReturn(focus: FocusState, timing: FocusTiming, now: number): boolean {
  return focus.returnedAt !== null && now - focus.returnedAt < timing.returnDelayMs;
}

/** Is this a good moment to interrupt? The full rule list is in lib/delivery.ts. */
export function isNaturalPause(trigger: FocusTrigger, focus: FocusState, timing: FocusTiming, now: number): boolean {
  if (PAUSE_TRIGGERS.has(trigger)) return true;
  if (focus.returnedAt !== null) {
    const sinceReturn = now - focus.returnedAt;
    if (sinceReturn >= timing.returnDelayMs && sinceReturn <= timing.returnWindowMs) return true;
  }
  return now - focus.lastTypingAt >= timing.typingPauseMs;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function isInQuietHours(quiet: QuietHours, now: number): boolean {
  if (!quiet.enabled || quiet.startMin === quiet.endMin) return false;
  const minute = minutesOfDay(new Date(now));
  return quiet.startMin < quiet.endMin
    ? minute >= quiet.startMin && minute < quiet.endMin
    : minute >= quiet.startMin || minute < quiet.endMin; // crosses midnight
}

/** Epoch ms of the next end of quiet hours after `now`. */
export function quietHoursEnd(quiet: QuietHours, now: number): number {
  const end = new Date(now);
  end.setHours(Math.floor(quiet.endMin / 60), quiet.endMin % 60, 0, 0);
  if (end.getTime() <= now) end.setDate(end.getDate() + 1);
  return end.getTime();
}

export function formatMinutes(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// ---- Sites ------------------------------------------------------------------

/** "https://www.Zoom.us/j/1" → "www.zoom.us". Returns "" for junk. */
export function normalizeSite(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/^\*\./, '')
    .replace(/[/?#:].*$/, '');
}

/** True if the URL's host is one of `sites` or a subdomain of one. */
export function hostMatches(url: string, sites: readonly string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return sites.some((site) => site !== '' && (host === site || host.endsWith(`.${site}`)));
}

/**
 * Pages where Chrome never runs content scripts, or where our overlay can't
 * draw: browser pages, the Web Store and the built-in PDF viewer.
 */
export function isRestrictedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) return true;
  if (parsed.hostname === 'chromewebstore.google.com') return true;
  if (parsed.hostname === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) return true;
  return parsed.pathname.toLowerCase().endsWith('.pdf');
}
