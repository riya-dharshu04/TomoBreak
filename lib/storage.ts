import { MODE_IDS, MODES } from '@/lib/modes';
import type { ModeId, ModeSettings, ReactionId, Settings, StorageKey, StorageSchema } from '@/utils/types';

/** Bump this and add a step to MIGRATIONS whenever the stored shape changes. */
export const STORAGE_VERSION = 8;

const STORAGE_KEYS: StorageKey[] = ['version', 'settings', 'characters', 'schedule', 'stats', 'bond', 'pomodoro', 'reactions', 'lessons'];

export const DEFAULT_MEETING_SITES: readonly string[] = ['meet.google.com', 'zoom.us', 'teams.microsoft.com'];
export const DEFAULT_SOCIAL_SITES: readonly string[] = ['youtube.com', 'instagram.com', 'x.com', 'twitter.com', 'reddit.com'];

/** The social-media nudge is opt-in; every other reaction starts on. */
const DEFAULT_REACTIONS: Record<ReactionId, boolean> = {
  lateNight: true,
  longSession: true,
  tabOverload: true,
  codingWins: true,
  socialNudge: false,
};

export function defaultSettings(): Settings {
  const modes = {} as Record<ModeId, ModeSettings>;
  const goals = {} as Record<ModeId, number>;
  for (const id of MODE_IDS) {
    modes[id] = { enabled: MODES[id].defaultEnabled, intervalMin: MODES[id].defaultIntervalMin };
    goals[id] = MODES[id].defaultGoal;
  }
  return {
    enabled: true,
    onboarded: false,
    modes,
    goals,
    pomodoroBreakMin: 5,
    quietHours: { enabled: false, startMin: 22 * 60, endMin: 8 * 60 },
    meetingSites: [...DEFAULT_MEETING_SITES],
    blockedSites: [],
    reactions: { ...DEFAULT_REACTIONS },
    lateNightStartMin: 60,
    socialSites: [...DEFAULT_SOCIAL_SITES],
    language: 'english',
    debugFastIntervals: false,
  };
}

function defaults(): StorageSchema {
  return {
    version: STORAGE_VERSION,
    settings: defaultSettings(),
    characters: { activeId: 'hamster' },
    schedule: { modes: {}, activeVisit: null, lastVisitEndAt: 0 },
    stats: { days: {} },
    bond: { characters: {}, lastSummaryWeek: '' },
    pomodoro: { phase: 'idle', endsAt: 0, round: 0, pendingVisit: null },
    reactions: {
      lastReactionAt: 0,
      pending: null,
      lastLateNight: '',
      activeSince: null,
      socialSince: null,
      lastTabOverloadAt: 0,
    },
    lessons: { cursor: { english: 0, japanese: 0 } },
  };
}

/** Retired default characters and the current one that replaces each. */
const RETIRED_CHARACTERS: Record<string, string> = {
  hana: 'girl',
  kenta: 'boy',
  kitsu: 'dog',
  // Character sets that only existed in local development builds.
  mimi: 'girl',
  aria: 'girl',
  sillyMimi: 'girl',
  sillyAria: 'girl',
  lily: 'girl',
  tomo: 'boy',
  kai: 'boy',
  sillyTomo: 'boy',
  sillyKai: 'boy',
  leo: 'boy',
  biscuit: 'dog',
  sillyBiscuit: 'dog',
  snoot: 'dog',
  mochi: 'cat',
  sillyMochi: 'cat',
  domino: 'cat',
  puffy: 'hamster',
  peanut: 'hamster',
};

/** Move users (and their affection and unlocks) off retired characters. */
function renameRetiredCharacters(data: Snapshot): Snapshot {
  const next: Snapshot = { ...data };
  const rename = (id: string): string => RETIRED_CHARACTERS[id] ?? id;
  if (isRecord(data.characters) && typeof data.characters.activeId === 'string') {
    next.characters = { ...data.characters, activeId: rename(data.characters.activeId) };
  }
  if (isRecord(data.bond) && isRecord(data.bond.characters)) {
    const characters: Snapshot = {};
    for (const [id, bond] of Object.entries(data.bond.characters)) characters[rename(id)] = bond;
    next.bond = { ...data.bond, characters };
  }
  return next;
}

/** Characters the user uploaded before uploads were removed (v8). */
function uploadedCharacterIds(data: Snapshot): string[] {
  if (!isRecord(data.characters) || !Array.isArray(data.characters.custom)) return [];
  return data.characters.custom.flatMap((c: unknown) => (isRecord(c) && typeof c.id === 'string' ? [c.id] : []));
}

/** Raw stored data of any past version; only migrations look inside it. */
type Snapshot = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Migration steps. MIGRATIONS[n] upgrades data stored at version n to n + 1.
 * Version 0 means "nothing stored yet", which defaults already cover.
 */
const MIGRATIONS: Record<number, (data: Snapshot) => Snapshot> = {
  0: (data) => data,
  // v1 → v2: uploads (characters.custom), pending reminders and the visit gap.
  1: (data) => {
    const next: Snapshot = { ...data };
    if (isRecord(data.characters)) next.characters = { ...data.characters, custom: [] };
    const schedule = data.schedule;
    if (isRecord(schedule)) {
      const modes: Snapshot = {};
      if (isRecord(schedule.modes)) {
        for (const [id, entry] of Object.entries(schedule.modes)) {
          modes[id] = isRecord(entry) ? { ...entry, pendingSince: null } : entry;
        }
      }
      next.schedule = { ...schedule, modes, lastVisitEndAt: 0 };
    }
    return next;
  },
  // v2 → v3: ActiveVisit gained kind/characterId; an in-flight visit is dropped.
  // New keys (bond, pomodoro, reactions) and settings are filled from defaults.
  2: (data) => (isRecord(data.schedule) ? { ...data, schedule: { ...data.schedule, activeVisit: null } } : data),
  // v3 → v7: the default characters were replaced (more than once).
  3: renameRetiredCharacters,
  4: renameRetiredCharacters,
  5: renameRetiredCharacters,
  6: renameRetiredCharacters,
  // v7 → v8: uploaded characters were removed. Users of one switch to the
  // default character; their bond data is dropped (images: see ensureInitialized).
  7: (data) => {
    const uploads = uploadedCharacterIds(data);
    const next: Snapshot = { ...data };
    if (isRecord(data.characters)) {
      const active = data.characters.activeId;
      next.characters = { activeId: typeof active === 'string' && !uploads.includes(active) ? active : 'hamster' };
    }
    if (isRecord(data.bond) && isRecord(data.bond.characters)) {
      const characters: Snapshot = {};
      for (const [id, bond] of Object.entries(data.bond.characters)) if (!uploads.includes(id)) characters[id] = bond;
      next.bond = { ...data.bond, characters };
    }
    return next;
  },
};

export function migrate(data: Snapshot): Snapshot {
  let current = data;
  let version = typeof current.version === 'number' ? current.version : 0;
  while (version < STORAGE_VERSION) {
    const step = MIGRATIONS[version];
    if (step) current = step(current);
    version += 1;
  }
  return { ...current, version: STORAGE_VERSION };
}

/**
 * Run once on install/startup: migrate old data and fill any missing keys
 * with defaults. Missing nested settings (e.g. a newly added mode) are merged.
 */
export async function ensureInitialized(): Promise<void> {
  // Only our own keys (old uploaded images live under separate keys).
  const stored = await chrome.storage.local.get(STORAGE_KEYS);
  const oldUploads = uploadedCharacterIds(stored);
  // After migration the data has the current shape; this is the trust boundary.
  const migrated = migrate(stored) as Partial<StorageSchema>;
  const base = defaults();
  const settings: Settings = migrated.settings
    ? {
        ...base.settings,
        ...migrated.settings,
        modes: { ...base.settings.modes, ...migrated.settings.modes },
        goals: { ...base.settings.goals, ...migrated.settings.goals },
        quietHours: { ...base.settings.quietHours, ...migrated.settings.quietHours },
        reactions: { ...base.settings.reactions, ...migrated.settings.reactions },
      }
    : base.settings;
  const next: StorageSchema = {
    ...base,
    ...migrated,
    settings,
    characters: { ...base.characters, ...migrated.characters },
    schedule: { ...base.schedule, ...migrated.schedule },
    bond: { ...base.bond, ...migrated.bond },
    pomodoro: { ...base.pomodoro, ...migrated.pomodoro },
    reactions: { ...base.reactions, ...migrated.reactions },
    lessons: { cursor: { ...base.lessons.cursor, ...migrated.lessons?.cursor } },
    version: STORAGE_VERSION,
  };
  await chrome.storage.local.set(next);
  // Images of characters uploaded before v8, stored as `charimg:<id>`.
  if (oldUploads.length > 0) await chrome.storage.local.remove(oldUploads.map((id) => `charimg:${id}`));
}

export async function getItem<K extends StorageKey>(key: K): Promise<StorageSchema[K]> {
  const result = (await chrome.storage.local.get(key)) as Partial<StorageSchema>;
  const value = result[key];
  return value === undefined ? defaults()[key] : (value as StorageSchema[K]);
}

export async function setItem<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * Read-modify-write, serialised within this JS context so two handlers in the
 * service worker (e.g. an alarm and an incoming answer) cannot interleave and
 * overwrite each other's changes. The queue is only a lock, not state.
 * Returning the current value unchanged skips the write (and change events).
 */
let queue: Promise<unknown> = Promise.resolve();
export function updateItem<K extends StorageKey>(
  key: K,
  update: (current: StorageSchema[K]) => StorageSchema[K],
): Promise<StorageSchema[K]> {
  const run = async (): Promise<StorageSchema[K]> => {
    const current = await getItem(key);
    const next = update(current);
    if (next !== current) await setItem(key, next);
    return next;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** Subscribe to changes of one key (works in every extension context). */
export function onItemChanged<K extends StorageKey>(
  key: K,
  callback: (next: StorageSchema[K], previous: StorageSchema[K] | undefined) => void,
): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    const change = changes[key];
    if (area !== 'local' || !change || change.newValue === undefined) return;
    callback(change.newValue as StorageSchema[K], change.oldValue as StorageSchema[K] | undefined);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
