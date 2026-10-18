import { MODE_IDS, MODES } from '@/lib/modes';
import type { ModeId, ModeSettings, Settings, StorageKey, StorageSchema } from '@/utils/types';

/** Bump this and add a step to MIGRATIONS whenever the stored shape changes. */
export const STORAGE_VERSION = 1;

export function defaultSettings(): Settings {
  const modes = {} as Record<ModeId, ModeSettings>;
  for (const id of MODE_IDS) {
    modes[id] = { enabled: MODES[id].defaultEnabled, intervalMin: MODES[id].defaultIntervalMin };
  }
  return { enabled: true, modes, debugFastIntervals: false };
}

function defaults(): StorageSchema {
  return {
    version: STORAGE_VERSION,
    settings: defaultSettings(),
    characters: { activeId: 'hana' },
    schedule: { modes: {}, activeVisit: null },
    stats: { days: {} },
  };
}

/**
 * Migration steps. MIGRATIONS[n] upgrades data stored at version n to n + 1.
 * Version 0 means "nothing stored yet", which defaults already cover.
 */
type StoredSnapshot = Partial<StorageSchema>;
const MIGRATIONS: Record<number, (data: StoredSnapshot) => StoredSnapshot> = {
  0: (data) => data,
};

export function migrate(data: StoredSnapshot): StoredSnapshot {
  let current = data;
  let version = current.version ?? 0;
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
  const stored = (await chrome.storage.local.get(null)) as StoredSnapshot;
  const migrated = migrate(stored);
  const base = defaults();
  const settings: Settings = migrated.settings
    ? { ...base.settings, ...migrated.settings, modes: { ...base.settings.modes, ...migrated.settings.modes } }
    : base.settings;
  const next: StorageSchema = { ...base, ...migrated, settings, version: STORAGE_VERSION };
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
