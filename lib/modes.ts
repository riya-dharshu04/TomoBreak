import type { ModeId, Settings } from '@/utils/types';

export interface ModeDefinition {
  id: ModeId;
  label: string;
  emoji: string;
  /** One line for the onboarding cards. */
  description: string;
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
  hydration: { id: 'hydration', label: 'Hydration', emoji: '💧', description: 'Little sips, all day long.', defaultIntervalMin: 45, defaultEnabled: true },
  eye: { id: 'eye', label: 'Eye break', emoji: '👀', description: '20-20-20: rest your eyes from the screen.', defaultIntervalMin: 20, defaultEnabled: false },
  posture: { id: 'posture', label: 'Posture', emoji: '🪑', description: 'A friendly sit-up-straight check.', defaultIntervalMin: 45, defaultEnabled: false },
  stretch: { id: 'stretch', label: 'Stretch', emoji: '🙆', description: 'Quick desk stretches with a timer.', defaultIntervalMin: 60, defaultEnabled: false },
  // Pomodoro is started from the popup; its "interval" is the focus length.
  pomodoro: { id: 'pomodoro', label: 'Pomodoro', emoji: '🍅', description: 'Focus sprints you start from the popup.', defaultIntervalMin: 25, defaultEnabled: false },
  // Entertainment is randomised between 60 and 120 min; this is the midpoint.
  entertainment: { id: 'entertainment', label: 'Entertainment', emoji: '🎉', description: 'A silly dance and a joke now and then.', defaultIntervalMin: 90, defaultEnabled: false },
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
