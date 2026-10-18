import type { ModeId, Settings } from '@/utils/types';

export interface ModeDefinition {
  id: ModeId;
  label: string;
  emoji: string;
  /** One line for the onboarding cards. */
  description: string;
  defaultIntervalMin: number;
  defaultEnabled: boolean;
  /** Yes answers per day that complete the mode for its streak. */
  defaultGoal: number;
}

export const MODE_IDS: readonly ModeId[] = [
  'hydration',
  'eye',
  'language',
  'posture',
  'stretch',
  'pomodoro',
  'entertainment',
];

export const MODES: Record<ModeId, ModeDefinition> = {
  hydration: { id: 'hydration', label: 'Hydration', emoji: '💧', description: 'Little sips, all day long.', defaultIntervalMin: 45, defaultEnabled: true, defaultGoal: 4 },
  eye: { id: 'eye', label: 'Eye break', emoji: '👀', description: '20-20-20: rest your eyes from the screen.', defaultIntervalMin: 20, defaultEnabled: false, defaultGoal: 6 },
  posture: { id: 'posture', label: 'Posture', emoji: '🪑', description: 'A friendly sit-up-straight check.', defaultIntervalMin: 45, defaultEnabled: false, defaultGoal: 4 },
  stretch: { id: 'stretch', label: 'Stretch', emoji: '🙆', description: 'Quick desk stretches with a timer.', defaultIntervalMin: 60, defaultEnabled: false, defaultGoal: 3 },
  // Pomodoro is started from the popup; its "interval" is the focus length.
  pomodoro: { id: 'pomodoro', label: 'Pomodoro', emoji: '🍅', description: 'Focus sprints you start from the popup.', defaultIntervalMin: 25, defaultEnabled: false, defaultGoal: 2 },
  // Entertainment is randomised between 60 and 120 min; this is the midpoint.
  entertainment: { id: 'entertainment', label: 'Entertainment', emoji: '🎉', description: 'A silly dance and a joke now and then.', defaultIntervalMin: 90, defaultEnabled: false, defaultGoal: 1 },
  language: { id: 'language', label: 'Language', emoji: '📚', description: 'Learn one English or Japanese word at a time.', defaultIntervalMin: 30, defaultEnabled: false, defaultGoal: 3 },
};

/** Modes run by interval alarms. Pomodoro is started from the popup instead. */
export const SCHEDULED_MODES: readonly ModeId[] = ['hydration', 'eye', 'posture', 'stretch', 'entertainment', 'language'];

/**
 * Modes that always visit on their own instead of being merged into one
 * wellness visit: a joke or a word lesson needs the whole bubble.
 */
export const SOLO_MODES: readonly ModeId[] = ['entertainment', 'language'];

/** Entertainment shows up at a random time in this range. */
const ENTERTAINMENT_RANGE_MIN = [60, 120] as const;

/** Snooze length for every mode. */
export const SNOOZE_MIN = 10;

/** Interval to use right now, honouring the hidden debug switch. */
export function effectiveIntervalMin(settings: Settings, mode: ModeId): number {
  return settings.debugFastIntervals ? 1 : settings.modes[mode].intervalMin;
}

/** Minutes until the next reminder: the interval, or random for Entertainment. */
export function nextDelayMin(settings: Settings, mode: ModeId): number {
  if (settings.debugFastIntervals) return 1;
  if (mode === 'entertainment') {
    const [min, max] = ENTERTAINMENT_RANGE_MIN;
    return min + Math.random() * (max - min);
  }
  return settings.modes[mode].intervalMin;
}
