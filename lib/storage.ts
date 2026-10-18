import { MODE_IDS, MODES } from '@/lib/modes';
import type { ModeId, ModeSettings, Settings, StorageKey, StorageSchema } from '@/utils/types';

/** Bump this and add a step to MIGRATIONS whenever the stored shape changes. */
export const STORAGE_VERSION = 2;

const STORAGE_KEYS: StorageKey[] = ['version', 'settings', 'characters', 'schedule', 'stats'];

export const DEFAULT_MEETING_SITES: readonly string[] = ['meet.google.com', 'zoom.us', 'teams.microsoft.com'];

export function defaultSettings(): Settings {
  const modes = {} as Record<ModeId, ModeSettings>;
  for (const id of MODE_IDS) {
    modes[id] = { enabled: MODES[id].defaultEnabled, intervalMin: MODES[id].defaultIntervalMin };
  }
  return {
    enabled: true,
    onboarded: false,
    modes,
    quietHours: { enabled: false, startMin: 22 * 60, endMin: 8 * 60 },
    meetingSites: [...DEFAULT_MEETING_SITES],
    blockedSites: [],
    debugFastIntervals: false,
  };
}

function defaults(): StorageSchema {
  return {
    version: STORAGE_VERSION,
    settings: defaultSettings(),
    characters: { activeId: 'hana', custom: [] },
    schedule: { modes: {}, activeVisit: null, lastVisitEndAt: 0 },
    stats: { days: {} },
  };
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
  // Only our own keys: custom character images can be large and are not needed.
  const stored = await chrome.storage.local.get(STORAGE_KEYS);
  // After migration the data has the current shape; this is the trust boundary.
  const migrated = migrate(stored) as Partial<StorageSchema>;
  const base = defaults();
  const settings: Settings = migrated.settings
    ? {
        ...base.settings,
        ...migrated.settings,
        modes: { ...base.settings.modes, ...migrated.settings.modes },
        quietHours: { ...base.settings.quietHours, ...migrated.settings.quietHours },
      }
    : base.settings;
  const next: StorageSchema = {
    ...base,
    ...migrated,
    settings,
    characters: { ...base.characters, ...migrated.characters },
    schedule: { ...base.schedule, ...migrated.schedule },
    version: STORAGE_VERSION,
  };
  await chrome.storage.local.set(next);
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
 */
let queue: Promise<unknown> = Promise.resolve();
export function updateItem<K extends StorageKey>(
  key: K,
  update: (current: StorageSchema[K]) => StorageSchema[K],
): Promise<StorageSchema[K]> {
  const run = async (): Promise<StorageSchema[K]> => {
    const next = update(await getItem(key));
    await setItem(key, next);
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
