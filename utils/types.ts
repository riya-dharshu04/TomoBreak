/**
 * All shared types for TomoBreak.
 *
 * Every object persisted in chrome.storage.local and every message passed
 * between the service worker, content scripts, popup and options page is
 * declared here, so the compiler can check both ends of every conversation.
 */

// ---------------------------------------------------------------------------
// Modes & answers
// ---------------------------------------------------------------------------

export type ModeId =
  | 'hydration'
  | 'eye'
  | 'posture'
  | 'stretch'
  | 'pomodoro'
  | 'entertainment';

/** How the user responded to a visit. `ignored` = auto-dismissed after 60 s. */
export type Answer = 'yes' | 'no' | 'snooze' | 'ignored';

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

/** Every visual state a character can be in. */
export type CharacterState =
  | 'idle'
  | 'walk'
  | 'talk'
  | 'happy'
  | 'sad'
  | 'sleepy'
  | 'surprised';

export type DefaultCharacterId = 'hana';

export interface CharacterStore {
  /** Id of the character that visits. Default ids or (later) upload ids. */
  activeId: DefaultCharacterId;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ModeSettings {
  enabled: boolean;
  /** Minutes between reminders. */
  intervalMin: number;
}

export interface Settings {
  /** Global on/off switch (popup). Off hides everything immediately. */
  enabled: boolean;
  modes: Record<ModeId, ModeSettings>;
  /** Hidden debug option: every interval becomes 1 minute. */
  debugFastIntervals: boolean;
}

// ---------------------------------------------------------------------------
// Schedule (all scheduler state lives in storage, never in SW memory)
// ---------------------------------------------------------------------------

export interface ModeSchedule {
  /** Epoch ms when this mode is next due. */
  nextDueAt: number;
  /** Interval the current nextDueAt was computed with; lets us detect changes. */
  intervalMin: number;
}

/** The visit currently on screen, if any. */
export interface ActiveVisit {
  id: string;
  tabId: number;
  modes: ModeId[];
  shownAt: number;
}

export interface ScheduleState {
  modes: Partial<Record<ModeId, ModeSchedule>>;
  activeVisit: ActiveVisit | null;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export type AnswerCounts = Record<Answer, number>;

/** Day key is local date `YYYY-MM-DD`. */
export type DailyStats = Partial<Record<ModeId, AnswerCounts>>;

export interface StatsStore {
  days: Record<string, DailyStats>;
}

// ---------------------------------------------------------------------------
// Storage root
// ---------------------------------------------------------------------------

/** Shape of chrome.storage.local. Each top-level key is stored separately. */
export interface StorageSchema {
  version: number;
  settings: Settings;
  characters: CharacterStore;
  schedule: ScheduleState;
  stats: StatsStore;
}

export type StorageKey = keyof StorageSchema;

// ---------------------------------------------------------------------------
// Visits (what the overlay renders)
// ---------------------------------------------------------------------------

export interface Visit {
  id: string;
  kind: 'reminder';
  modes: ModeId[];
  characterId: DefaultCharacterId;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Messages sent TO the service worker (from content scripts or popup). */
export type BackgroundMessage =
  | { type: 'visit/answer'; visitId: string; answer: Answer }
  | { type: 'debug/visitNow' };

/** Messages sent FROM the service worker TO a tab's content script. */
export type TabMessage =
  | { type: 'visit/show'; visit: Visit }
  | { type: 'visit/hide' };

/** Response type for each message, keyed by `type`. */
export interface MessageResponses {
  'visit/answer': { ok: true };
  'debug/visitNow': { ok: boolean; reason?: string };
  'visit/show': { ok: true };
  'visit/hide': { ok: true };
}

export type AnyMessage = BackgroundMessage | TabMessage;
export type ResponseOf<M extends AnyMessage> = MessageResponses[M['type']];
