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

export type StretchId =
  | 'neckRoll'
  | 'shoulderShrug'
  | 'wristStretch'
  | 'seatedTwist'
  | 'overheadReach'
  | 'chestOpener'
  | 'sideBend'
  | 'ankleCircles';

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

/** Body poses layered on top of a state (posture check, stretches, eye rest). */
export type Pose =
  | 'slouch'
  | 'straight'
  | 'rest-eyes'
  | 'neck'
  | 'shrug'
  | 'wrist'
  | 'twist'
  | 'reach'
  | 'chest'
  | 'side'
  | 'ankle';

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
// Bond (affection, streak unlocks, weekly summary)
// ---------------------------------------------------------------------------

export type Mood = 'thrilled' | 'happy' | 'okay' | 'worried';

/** Streak milestone rewards: 3 days dance, 7 outfit, 14 lines, 30 celebration. */
export type UnlockId = 'dance' | 'outfit' | 'lines' | 'celebration';

export interface CharacterBond {
  /** 10..100, starts at 50. */
  affection: number;
  unlocks: UnlockId[];
  /** Unlocks whose animation has been shown. */
  announced: UnlockId[];
}

export interface BondStore {
  characters: Record<string, CharacterBond>;
  /** Week key (`YYYY-MM-DD` of its Monday) of the last weekly summary. */
  lastSummaryWeek: string;
}

/** Yes counts per mode for the previous week, shown on the first visit of a week. */
export interface WeeklySummary {
  counts: Partial<Record<ModeId, number>>;
  total: number;
}

// ---------------------------------------------------------------------------
// Context reactions
// ---------------------------------------------------------------------------

/** User-facing reaction toggles. */
export type ReactionId = 'lateNight' | 'longSession' | 'tabOverload' | 'codingWins' | 'socialNudge';

/** What the buddy actually reacts to; coding wins split into win and fail. */
export type ReactionKind = 'lateNight' | 'longSession' | 'tabOverload' | 'codingWin' | 'codingFail' | 'socialNudge';

/** Sent by a site adapter when it sees a result on the page. */
export type AdapterEvent = 'codingWin' | 'codingFail';

export interface ReactionState {
  /** Epoch ms of the last reaction shown (max one per 15 min). */
  lastReactionAt: number;
  /** A reaction waiting for a natural pause. */
  pending: { kind: ReactionKind; since: number } | null;
  /** Evening date (`YYYY-MM-DD`) of the last late-night reaction. */
  lastLateNight: string;
  /** Start of the current stretch of activity without a 5-minute break. */
  activeSince: number | null;
  /** Since when the active tab has been a social site. */
  socialSince: number | null;
  lastTabOverloadAt: number;
}

// ---------------------------------------------------------------------------
// Pomodoro
// ---------------------------------------------------------------------------

export type PomodoroPhase = 'idle' | 'focus' | 'break';

export interface PomodoroState {
  phase: PomodoroPhase;
  /** Epoch ms when the current phase ends. */
  endsAt: number;
  /** Completed focus sessions in this run. */
  round: number;
  /** A Pomodoro visit waiting to be shown: break start, or break over. */
  pendingVisit: 'break' | 'end' | null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ModeSettings {
  enabled: boolean;
  /** Minutes between reminders (Pomodoro: focus length). */
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
  /** Yes answers per day that count as "done" for a mode's streak. */
  goals: Record<ModeId, number>;
  pomodoroBreakMin: number;
  quietHours: QuietHours;
  /** Hostnames of video-call sites; the buddy stays away during calls. */
  meetingSites: string[];
  /** Hostnames where the buddy never walks onto the page. */
  blockedSites: string[];
  reactions: Record<ReactionId, boolean>;
  /** Late-night reactions start at this minute of the day (until 5 AM). */
  lateNightStartMin: number;
  /** Sites for the optional social-media nudge. */
  socialSites: string[];
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
  kind: VisitKind;
  channel: VisitChannel;
  /** Tab showing the overlay; null for notifications. */
  tabId: number | null;
  /** Modes the answer applies to (empty for reactions). */
  modes: ModeId[];
  characterId: string;
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
  bond: BondStore;
  pomodoro: PomodoroState;
  reactions: ReactionState;
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
  /** When the user went idle or locked the screen; null while active. */
  idleSince: number | null;
}

export interface SessionSchema {
  focus: FocusState;
}

// ---------------------------------------------------------------------------
// Visits (what the overlay renders)
// ---------------------------------------------------------------------------

/** `walk` = walk to the centre; `peek` = gentle peek in from the edge. */
export type VisitEntrance = 'walk' | 'peek';

interface VisitBase {
  id: string;
  characterId: string;
  entrance: VisitEntrance;
  /** Options-page preview: plays locally, never reported. */
  preview: boolean;
  mood: Mood;
  /** Unlocked perks to wear/use during this visit. */
  unlocks: UnlockId[];
  /** Unlocks earned earlier (e.g. via a notification) to celebrate first. */
  announce: UnlockId[];
  /** Weekly summary card to present first, on the first visit of a week. */
  summary: WeeklySummary | null;
}

export type VisitBody =
  /** Wellness reminder(s). With pomodoroBreakMin it is a Pomodoro break visit. */
  | { kind: 'reminder'; modes: ModeId[]; pomodoroBreakMin: number | null }
  /** Pomodoro break is over: start another focus round? */
  | { kind: 'pomodoroEnd' }
  | { kind: 'reaction'; reaction: ReactionKind };

export type VisitKind = VisitBody['kind'];
export type Visit = VisitBase & VisitBody;

/** Why a tab declined to show a visit right now. */
export type VisitRefusal = 'typing' | 'fullscreen';

export type VisitShowResult = { ok: true } | { ok: false; reason: VisitRefusal };

/** What the service worker tells the overlay after an answer. */
export interface AnswerOutcome {
  /** Streak rewards unlocked by this answer; the overlay celebrates them. */
  unlocks: UnlockId[];
}

/** Debug scenarios the popup can trigger. */
export type DebugScenario =
  | { type: 'mode'; mode: ModeId }
  | { type: 'merged' }
  | { type: 'pomodoroBreak' }
  | { type: 'pomodoroEnd' }
  | { type: 'reaction'; reaction: ReactionKind }
  | { type: 'summary' }
  | { type: 'unlock' };

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Messages sent TO the service worker (from content scripts or popup). */
export type BackgroundMessage =
  | { type: 'visit/answer'; visitId: string; answer: Answer }
  /** Throttled "the user is here" signal. `typing` is a flag, never key data. */
  | { type: 'activity/ping'; typing: boolean }
  | { type: 'adapter/event'; event: AdapterEvent }
  | { type: 'pomodoro/start' }
  | { type: 'pomodoro/stop' }
  | { type: 'debug/visitNow'; scenario: DebugScenario };

/** Messages sent FROM the service worker TO a tab's content script. */
export type TabMessage =
  | { type: 'visit/show'; visit: Visit }
  | { type: 'visit/hide' };

/** Response type for each message, keyed by `type`. */
export interface MessageResponses {
  'visit/answer': AnswerOutcome;
  'activity/ping': { ok: true };
  'adapter/event': { ok: true };
  'pomodoro/start': { ok: true };
  'pomodoro/stop': { ok: true };
  'debug/visitNow': { ok: boolean; reason?: string };
  'visit/show': VisitShowResult;
  'visit/hide': { ok: true };
}

export type AnyMessage = BackgroundMessage | TabMessage;
export type ResponseOf<M extends AnyMessage> = MessageResponses[M['type']];
