/**
 * All shared types for TomoBreak.
 *
 * Every object persisted in chrome.storage and every message passed between
 * the service worker, content scripts, popup and options page is declared
 * here, so the compiler can check both ends of every conversation.
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

export type DefaultCharacterId = 'hana' | 'kenta' | 'kitsu';

/** States a user can upload an image for. Others reuse these with CSS effects. */
export type UploadState = 'idle' | 'walk' | 'happy' | 'sad';

/** Data URLs (`data:image/...`) per uploaded state; at least one is present. */
export type CharacterImages = Partial<Record<UploadState, string>>;

/** Metadata of an uploaded character. Its images live under `charimg:<id>`. */
export interface CustomCharacter {
  id: string;
  name: string;
  createdAt: number;
}

export interface CharacterStore {
  /** Id of the character that visits: a DefaultCharacterId or a custom id. */
  activeId: string;
  custom: CustomCharacter[];
}

/**
 * Storage key holding one custom character's images. Kept out of
 * `characters` so reading the active character never loads every upload.
 */
export type CharacterImagesKey = `charimg:${string}`;

/** Everything the overlay needs to draw a character. */
export type CharacterRender =
  | { kind: 'default'; id: DefaultCharacterId }
  | { kind: 'custom'; id: string; images: CharacterImages };

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ModeSettings {
  enabled: boolean;
  /** Minutes between reminders. */
  intervalMin: number;
}

export interface QuietHours {
  enabled: boolean;
  /** Minutes after local midnight. start > end means the range crosses midnight. */
  startMin: number;
  endMin: number;
}

export interface Settings {
  /** Global on/off switch (popup). Off hides everything immediately. */
  enabled: boolean;
  /** Set once the user saved the onboarding page. */
  onboarded: boolean;
  modes: Record<ModeId, ModeSettings>;
  quietHours: QuietHours;
  /** Hostnames of video-call sites; the buddy stays away during calls. */
  meetingSites: string[];
  /** Hostnames where the buddy never walks onto the page. */
  blockedSites: string[];
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
  /**
   * Epoch ms when the reminder became due and started waiting for a natural
   * pause, or null while it is not yet due.
   */
  pendingSince: number | null;
}

/** Where a visit is shown: on the page, or as a system notification fallback. */
export type VisitChannel = 'overlay' | 'notification';

/** The visit currently on screen, if any. */
export interface ActiveVisit {
  id: string;
  channel: VisitChannel;
  /** Tab showing the overlay; null for notifications. */
  tabId: number | null;
  modes: ModeId[];
  shownAt: number;
}

export interface ScheduleState {
  modes: Partial<Record<ModeId, ModeSchedule>>;
  activeVisit: ActiveVisit | null;
  /** Epoch ms when the last visit ended; enforces the gap between visits. */
  lastVisitEndAt: number;
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
// Storage roots
// ---------------------------------------------------------------------------

/**
 * Shape of chrome.storage.local. Each top-level key is stored separately.
 * Custom character images use additional `CharacterImagesKey` keys.
 */
export interface StorageSchema {
  version: number;
  settings: Settings;
  characters: CharacterStore;
  schedule: ScheduleState;
  stats: StatsStore;
}

export type StorageKey = keyof StorageSchema;

/**
 * Recent activity, kept in chrome.storage.session: it changes every few
 * seconds and only matters while the browser is running. Contains times
 * only, never which keys were pressed or what is on the page.
 */
export interface FocusState {
  /** Last activity report of any kind (typing, scrolling, pointer). */
  lastActivityAt: number;
  /** Last report that included typing. */
  lastTypingAt: number;
  /** When the user came back from idle / a locked screen, until a visit uses it. */
  returnedAt: number | null;
}

export interface SessionSchema {
  focus: FocusState;
}

// ---------------------------------------------------------------------------
// Visits (what the overlay renders)
// ---------------------------------------------------------------------------

/** `walk` = walk to the centre; `peek` = gentle peek in from the edge. */
export type VisitEntrance = 'walk' | 'peek';

export interface Visit {
  id: string;
  /** `preview` visits play on the options page and are never reported. */
  kind: 'reminder' | 'preview';
  modes: ModeId[];
  characterId: string;
  entrance: VisitEntrance;
}

/** Why a tab declined to show a visit right now. */
export type VisitRefusal = 'typing' | 'fullscreen';

export type VisitShowResult = { ok: true } | { ok: false; reason: VisitRefusal };

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Messages sent TO the service worker (from content scripts or popup). */
export type BackgroundMessage =
  | { type: 'visit/answer'; visitId: string; answer: Answer }
  /** Throttled "the user is here" signal. `typing` is a flag, never key data. */
  | { type: 'activity/ping'; typing: boolean }
  | { type: 'debug/visitNow' };

/** Messages sent FROM the service worker TO a tab's content script. */
export type TabMessage =
  | { type: 'visit/show'; visit: Visit }
  | { type: 'visit/hide' };

/** Response type for each message, keyed by `type`. */
export interface MessageResponses {
  'visit/answer': { ok: true };
  'activity/ping': { ok: true };
  'debug/visitNow': { ok: boolean; reason?: string };
  'visit/show': VisitShowResult;
  'visit/hide': { ok: true };
}

export type AnyMessage = BackgroundMessage | TabMessage;
export type ResponseOf<M extends AnyMessage> = MessageResponses[M['type']];
