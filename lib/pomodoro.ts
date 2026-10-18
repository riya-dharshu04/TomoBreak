/**
 * Pomodoro timer, run with chrome.alarms (never setTimeout in the service
 * worker). Started from the popup: focus → break → "another round?" → ...
 * While focusing, other reminders wait and are bundled into the break visit
 * (see lib/delivery.ts).
 */
import { effectiveIntervalMin } from '@/lib/modes';
import { recordAnswer } from '@/lib/stats';
import { getItem, updateItem } from '@/lib/storage';
import type { Answer, PomodoroState, Settings } from '@/utils/types';

const MINUTE = 60_000;
export const POMODORO_ALARM = 'pomodoro:phase';
/** "5 more min" on the break-over visit. */
const EXTEND_BREAK_MIN = 5;

function breakMinutes(settings: Settings): number {
  return settings.debugFastIntervals ? 1 : settings.pomodoroBreakMin;
}

async function schedulePhaseEnd(state: PomodoroState): Promise<void> {
  await chrome.alarms.create(POMODORO_ALARM, { when: Math.max(state.endsAt, Date.now() + 1000) });
}

export async function startFocus(): Promise<void> {
  const settings = await getItem('settings');
  const focusMin = effectiveIntervalMin(settings, 'pomodoro');
  const state = await updateItem('pomodoro', (p) => ({
    phase: 'focus',
    endsAt: Date.now() + focusMin * MINUTE,
    round: p.phase === 'idle' ? 0 : p.round,
    pendingVisit: null,
  }));
  await schedulePhaseEnd(state);
}

export async function stopPomodoro(): Promise<void> {
  await updateItem('pomodoro', () => ({ phase: 'idle', endsAt: 0, round: 0, pendingVisit: null }));
  await chrome.alarms.clear(POMODORO_ALARM);
}

async function extendBreak(minutes: number): Promise<void> {
  const state = await updateItem('pomodoro', (p) => ({
    ...p,
    phase: 'break',
    endsAt: Date.now() + minutes * MINUTE,
    pendingVisit: null,
  }));
  await schedulePhaseEnd(state);
}

/** The current phase ran out. */
export async function handlePomodoroAlarm(): Promise<void> {
  const [settings, current] = await Promise.all([getItem('settings'), getItem('pomodoro')]);
  if (current.phase === 'focus') {
    // A finished focus session counts toward the Pomodoro streak.
    await recordAnswer('pomodoro', 'yes');
    const state = await updateItem('pomodoro', (p) => ({
      phase: 'break',
      endsAt: Date.now() + breakMinutes(settings) * MINUTE,
      round: p.round + 1,
      pendingVisit: 'break',
    }));
    await schedulePhaseEnd(state);
  } else if (current.phase === 'break') {
    await updateItem('pomodoro', (p) => ({ ...p, pendingVisit: 'end' }));
  }
}

/** A Pomodoro visit was shown (on the page or as a notification). */
export async function clearPendingPomodoroVisit(): Promise<void> {
  await updateItem('pomodoro', (p) => ({ ...p, pendingVisit: null }));
}

/** Answer to "Break's over! Another round?" */
export async function handlePomodoroAnswer(answer: Answer): Promise<void> {
  if (answer === 'yes') await startFocus();
  else if (answer === 'snooze') await extendBreak(EXTEND_BREAK_MIN);
  else await stopPomodoro();
}

/** Re-arm the alarm after a browser restart; stop if Pomodoro was switched off. */
export async function syncPomodoro(settings: Settings): Promise<void> {
  const state = await getItem('pomodoro');
  if (state.phase === 'idle') return;
  if (!settings.enabled || !settings.modes.pomodoro.enabled) {
    await stopPomodoro();
    return;
  }
  if (!(await chrome.alarms.get(POMODORO_ALARM))) await schedulePhaseEnd(state);
}
