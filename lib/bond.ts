/**
 * Bond system (Tamagotchi style): affection per character, mood, daily
 * streaks per mode, streak unlocks and the weekly summary.
 *
 * Streaks are computed from the daily stats rather than stored, so they can
 * never drift out of sync with what the stats page shows.
 */
import { MODE_IDS } from '@/lib/modes';
import { dayKey } from '@/lib/stats';
import { getItem, updateItem } from '@/lib/storage';
import type {
  Answer,
  BondStore,
  CharacterBond,
  ModeId,
  Mood,
  Settings,
  StatsStore,
  UnlockId,
  WeeklySummary,
} from '@/utils/types';

export const AFFECTION_START = 50;
export const AFFECTION_MIN = 10;
export const AFFECTION_MAX = 100;

/** Kind by design: No and ignoring cost little, and affection never drops below 10. */
const AFFECTION_DELTA: Record<Answer, number> = { yes: 5, no: -3, snooze: 0, ignored: -1 };

export interface Milestone {
  days: number;
  unlock: UnlockId;
  label: string;
}

export const MILESTONES: readonly Milestone[] = [
  { days: 3, unlock: 'dance', label: 'A new dance' },
  { days: 7, unlock: 'outfit', label: 'A party hat' },
  { days: 14, unlock: 'lines', label: 'New things to say' },
  { days: 30, unlock: 'celebration', label: 'A special celebration' },
];

export function defaultBond(): CharacterBond {
  return { affection: AFFECTION_START, unlocks: [], announced: [] };
}

export function bondFor(store: BondStore, characterId: string): CharacterBond {
  return store.characters[characterId] ?? defaultBond();
}

export function moodFor(affection: number): Mood {
  if (affection >= 80) return 'thrilled';
  if (affection >= 60) return 'happy';
  if (affection >= 35) return 'okay';
  return 'worried';
}

function clampAffection(value: number): number {
  return Math.min(AFFECTION_MAX, Math.max(AFFECTION_MIN, value));
}

// ---- Streaks --------------------------------------------------------------------

function yesCount(stats: StatsStore, mode: ModeId, date: Date): number {
  return stats.days[dayKey(date)]?.[mode]?.yes ?? 0;
}

/**
 * Consecutive days the mode's daily goal was met. A day that isn't done yet
 * doesn't break the streak: counting starts from yesterday until today's
 * goal is reached.
 */
export function streakFor(stats: StatsStore, mode: ModeId, goal: number, today = new Date()): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const met = (): boolean => yesCount(stats, mode, cursor) >= Math.max(1, goal);
  if (!met()) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (met() && streak < 3650) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Best current streak across the enabled modes; drives unlocks. */
export function bestStreak(stats: StatsStore, settings: Settings, today = new Date()): number {
  return MODE_IDS.filter((mode) => settings.modes[mode].enabled).reduce(
    (best, mode) => Math.max(best, streakFor(stats, mode, settings.goals[mode], today)),
    0,
  );
}

// ---- Answers & unlocks -----------------------------------------------------------

/**
 * Apply one visit's answer to the character's bond. Call after the answer
 * was recorded in stats. Returns rewards unlocked just now.
 */
export async function applyBondAnswer(characterId: string, answer: Answer): Promise<UnlockId[]> {
  const [settings, stats] = await Promise.all([getItem('settings'), getItem('stats')]);
  const best = answer === 'yes' ? bestStreak(stats, settings) : 0;
  const result: { earned: UnlockId[] } = { earned: [] };
  await updateItem('bond', (store) => {
    const bond = bondFor(store, characterId);
    const earned = MILESTONES.filter((m) => best >= m.days && !bond.unlocks.includes(m.unlock)).map((m) => m.unlock);
    result.earned = earned;
    const next: CharacterBond = {
      ...bond,
      affection: clampAffection(bond.affection + AFFECTION_DELTA[answer]),
      unlocks: [...bond.unlocks, ...earned],
    };
    return { ...store, characters: { ...store.characters, [characterId]: next } };
  });
  return result.earned;
}

/** The unlock animation for these has been played. */
export async function markAnnounced(characterId: string, unlocks: readonly UnlockId[]): Promise<void> {
  if (unlocks.length === 0) return;
  await updateItem('bond', (store) => {
    const bond = bondFor(store, characterId);
    const announced = [...new Set([...bond.announced, ...unlocks])];
    return { ...store, characters: { ...store.characters, [characterId]: { ...bond, announced } } };
  });
}

export function unannounced(bond: CharacterBond): UnlockId[] {
  return bond.unlocks.filter((unlock) => !bond.announced.includes(unlock));
}

// ---- Weekly summary --------------------------------------------------------------

function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** `YYYY-MM-DD` of the Monday starting the week that contains `date`. */
export function weekKey(date: Date): string {
  return dayKey(mondayOf(date));
}

/** Yes counts per mode over the 7 days ending the day before `end`. */
export function summarizeDays(stats: StatsStore, end: Date): WeeklySummary {
  const counts: Partial<Record<ModeId, number>> = {};
  let total = 0;
  const cursor = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  for (let i = 0; i < 7; i += 1) {
    cursor.setDate(cursor.getDate() - 1);
    for (const mode of MODE_IDS) {
      const yes = yesCount(stats, mode, cursor);
      if (yes > 0) {
        counts[mode] = (counts[mode] ?? 0) + yes;
        total += yes;
      }
    }
  }
  return { counts, total };
}

export interface PendingSummary {
  week: string;
  /** Null when last week had nothing to celebrate; the week is still marked. */
  summary: WeeklySummary | null;
}

/** The summary owed for this week, if it hasn't been presented yet. */
export async function pendingWeeklySummary(now = new Date()): Promise<PendingSummary | null> {
  const [bond, stats] = await Promise.all([getItem('bond'), getItem('stats')]);
  const week = weekKey(now);
  if (bond.lastSummaryWeek === week) return null;
  const summary = summarizeDays(stats, mondayOf(now));
  return { week, summary: summary.total > 0 ? summary : null };
}

export async function markSummaryShown(week: string): Promise<void> {
  await updateItem('bond', (store) => ({ ...store, lastSummaryWeek: week }));
}
