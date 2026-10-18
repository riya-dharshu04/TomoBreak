/**
 * Bond & stats tab: affection and mood, streaks per mode, unlocks, and
 * "Yes" answers per day for the last 7 or 30 days.
 */
import { DEFAULT_CHARACTERS } from '@/assets/characters';
import { MILESTONES, bestStreak, bondFor, moodFor, streakFor } from '@/lib/bond';
import { toCharacterId } from '@/lib/characters';
import { byId, el } from '@/lib/dom';
import { MODE_IDS, MODES } from '@/lib/modes';
import { CharacterView } from '@/lib/overlay/character-view';
import { dayKey } from '@/lib/stats';
import { getItem } from '@/lib/storage';
import type { ModeId, Mood, StatsStore } from '@/utils/types';
import { barChart, type Bar } from './charts';

const MOOD_LABEL: Record<Mood, string> = {
  thrilled: 'Thrilled 💖 — you two are best friends!',
  happy: 'Happy 😊 — things are going great.',
  okay: 'Okay 🙂 — a few more Yes answers will cheer them up.',
  worried: 'A little worried 🥺 — they just want you to be okay.',
};

const UNITS: Record<ModeId, string> = {
  hydration: 'glasses',
  eye: 'eye breaks',
  posture: 'posture fixes',
  stretch: 'stretches',
  pomodoro: 'sessions',
  entertainment: 'laughs',
  language: 'words',
};

const avatar = byId('bond-avatar', HTMLDivElement);
const moodText = byId('bond-mood', HTMLParagraphElement);
const bondValue = byId('bond-value', HTMLSpanElement);
const bondMeter = byId('bond-meter', HTMLDivElement);
const bondFill = byId('bond-fill', HTMLSpanElement);
const streakList = byId('streak-list', HTMLUListElement);
const unlockList = byId('unlock-list', HTMLUListElement);
const charts = byId('charts', HTMLDivElement);

let range = 7;

function lastDays(count: number): Date[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (count - 1 - i)));
}

function barsFor(stats: StatsStore, mode: ModeId, days: readonly Date[]): Bar[] {
  return days.map((date) => ({
    label: days.length <= 7 ? date.toLocaleDateString(undefined, { weekday: 'short' }) : String(date.getDate()),
    longLabel: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    value: stats.days[dayKey(date)]?.[mode]?.yes ?? 0,
  }));
}

export async function renderStats(): Promise<void> {
  const [settings, characters, bondStore, stats] = await Promise.all([
    getItem('settings'),
    getItem('characters'),
    getItem('bond'),
    getItem('stats'),
  ]);
  const bond = bondFor(bondStore, toCharacterId(characters.activeId));
  const mood = moodFor(bond.affection);
  const characterId = toCharacterId(characters.activeId);
  const name = DEFAULT_CHARACTERS[characterId].name;

  const view = new CharacterView(characterId);
  view.setMood(mood);
  view.setLook(bond.unlocks);
  avatar.replaceChildren(view.element);
  moodText.textContent = `Your ${name.toLowerCase()} is ${MOOD_LABEL[mood]}`;
  bondValue.textContent = `${bond.affection} / 100`;
  bondMeter.setAttribute('aria-valuenow', String(bond.affection));
  bondFill.style.width = `${bond.affection}%`;

  // Streaks for enabled modes (and any mode with history).
  const today = dayKey();
  const shown = MODE_IDS.filter((mode) => settings.modes[mode].enabled || Object.values(stats.days).some((d) => (d[mode]?.yes ?? 0) > 0));
  streakList.replaceChildren(
    ...shown.map((mode) => {
      const goal = settings.goals[mode];
      const streak = streakFor(stats, mode, goal);
      const done = stats.days[today]?.[mode]?.yes ?? 0;
      const item = el('li', 'streak');
      item.append(
        el('span', 'streak-name', `${MODES[mode].emoji} ${MODES[mode].label}`),
        el('span', 'streak-days', streak > 0 ? `🔥 ${streak}-day streak` : 'No streak yet'),
        el('span', 'streak-today', `Today ${Math.min(done, goal)}/${goal}`),
      );
      return item;
    }),
  );
  if (shown.length === 0) streakList.append(el('li', 'hint', 'Turn on a mode to start a streak.'));

  const best = bestStreak(stats, settings);
  unlockList.replaceChildren(
    ...MILESTONES.map((milestone) => {
      const unlocked = bond.unlocks.includes(milestone.unlock);
      const item = el('li', unlocked ? 'unlock is-unlocked' : 'unlock');
      const status = unlocked ? 'Unlocked ✓' : `${Math.max(0, milestone.days - best)} days to go`;
      item.append(el('span', 'unlock-days', `${milestone.days} days`), el('span', 'unlock-name', milestone.label), el('span', 'unlock-status', status));
      return item;
    }),
  );

  const days = lastDays(range);
  const chartModes = shown.length > 0 ? shown : (['hydration'] as const);
  charts.replaceChildren(...chartModes.map((mode) => barChart(`${MODES[mode].emoji} ${MODES[mode].label}`, barsFor(stats, mode, days), UNITS[mode])));
}

export function initStats(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="range"]')) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      range = Number(input.value) === 30 ? 30 : 7;
      void renderStats();
    });
  }
}
