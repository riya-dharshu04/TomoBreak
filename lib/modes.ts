import type { ModeId, Settings } from '@/utils/types';

export interface ModeDefinition {
  id: ModeId;
  label: string;
  emoji: string;
  defaultIntervalMin: number;
  defaultEnabled: boolean;
}

export const MODE_IDS: readonly ModeId[] = [
  'hydration',
  'eye',
  'posture',
  'stretch',
  'pomodoro',
  'entertainment',
];

export const MODES: Record<ModeId, ModeDefinition> = {
  hydration: { id: 'hydration', label: 'Hydration', emoji: '💧', defaultIntervalMin: 45, defaultEnabled: true },
  eye: { id: 'eye', label: 'Eye break', emoji: '👀', defaultIntervalMin: 20, defaultEnabled: false },
  posture: { id: 'posture', label: 'Posture', emoji: '🪑', defaultIntervalMin: 45, defaultEnabled: false },
  stretch: { id: 'stretch', label: 'Stretch', emoji: '🙆', defaultIntervalMin: 60, defaultEnabled: false },
  // Pomodoro is started from the popup; its "interval" is the focus length.
  pomodoro: { id: 'pomodoro', label: 'Pomodoro', emoji: '🍅', defaultIntervalMin: 25, defaultEnabled: false },
  // Entertainment is randomised between 60 and 120 min; this is the midpoint.
  entertainment: { id: 'entertainment', label: 'Entertainment', emoji: '🎉', defaultIntervalMin: 90, defaultEnabled: false },
};

/**
 * Modes that the scheduler actually runs in this build.
 * Phase 1 ships Hydration only; later phases extend this list.
 */
export const SCHEDULED_MODES: readonly ModeId[] = ['hydration'];

/** Snooze length for every mode. */
export const SNOOZE_MIN = 10;

/** Interval to use right now, honouring the hidden debug switch. */
export function effectiveIntervalMin(settings: Settings, mode: ModeId): number {
  return settings.debugFastIntervals ? 1 : settings.modes[mode].intervalMin;
}
