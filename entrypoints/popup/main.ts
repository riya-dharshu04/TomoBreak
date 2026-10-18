import { DEFAULT_CHARACTERS } from '@/assets/characters';
import { bondFor, moodFor } from '@/lib/bond';
import { isDefaultCharacterId } from '@/lib/characters';
import { byId } from '@/lib/dom';
import { formatMinutes, isInQuietHours } from '@/lib/focus';
import { sendToBackground } from '@/lib/messaging';
import { MODE_IDS, MODES } from '@/lib/modes';
import { getItem, onItemChanged, updateItem } from '@/lib/storage';
import type { DebugScenario, ModeId, Mood, PomodoroState, ReactionKind, ScheduleState, Settings } from '@/utils/types';

const enabledInput = byId('enabled', HTMLInputElement);
const moodText = byId('mood', HTMLParagraphElement);
const statusText = byId('status', HTMLParagraphElement);
const pomodoroPanel = byId('pomodoro', HTMLElement);
const pomodoroPhase = byId('pomodoro-phase', HTMLSpanElement);
const pomodoroTime = byId('pomodoro-time', HTMLParagraphElement);
const pomodoroToggle = byId('pomodoro-toggle', HTMLButtonElement);
const settingsButton = byId('open-settings', HTMLButtonElement);
const debugPanel = byId('debug', HTMLElement);
const fastInput = byId('fast', HTMLInputElement);
const scenarioSelect = byId('scenario', HTMLSelectElement);
const visitNowButton = byId('visit-now', HTMLButtonElement);
const debugMsg = byId('debug-msg', HTMLParagraphElement);
const shortcutLabel = byId('shortcut', HTMLSpanElement);
const versionLabel = byId('version', HTMLSpanElement);

const MOOD_TEXT: Record<Mood, string> = {
  thrilled: 'is thrilled to be with you 💖',
  happy: 'is happy 😊',
  okay: 'is doing okay 🙂',
  worried: 'is a little worried about you 🥺',
};

const REACTION_KINDS: readonly ReactionKind[] = ['lateNight', 'longSession', 'tabOverload', 'codingWin', 'codingFail', 'socialNudge'];

/** The Pomodoro state last read from storage; the 1 s ticker reads it. */
let pomodoro: PomodoroState | null = null;

function describeNext(settings: Settings, schedule: ScheduleState): string {
  if (!settings.enabled) return 'Your buddy is resting. Turn visits on to get reminders.';
  if (schedule.activeVisit) return 'Your buddy is visiting right now!';
  const { quietHours } = settings;
  if (isInQuietHours(quietHours, Date.now())) return `Quiet hours until ${formatMinutes(quietHours.endMin)}. Rest well!`;
  if (pomodoro?.phase === 'focus') return 'Focusing: reminders will wait for your break.';
  const upcoming = MODE_IDS.flatMap((id) => {
    const entry = schedule.modes[id];
    return entry ? [{ id, at: entry.nextDueAt, pending: entry.pendingSince !== null }] : [];
  }).sort((a, b) => Number(b.pending) - Number(a.pending) || a.at - b.at)[0];
  if (!upcoming) return 'No reminders are switched on.';
  const label = `${MODES[upcoming.id].emoji} ${MODES[upcoming.id].label}`;
  if (upcoming.pending) return `${label}: waiting for a pause in your flow`;
  const minutes = Math.max(0, Math.round((upcoming.at - Date.now()) / 60_000));
  return minutes === 0 ? `${label}: any moment now` : `${label}: in ${minutes} min`;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function renderPomodoro(settings: Settings): void {
  pomodoroPanel.hidden = !settings.enabled || !settings.modes.pomodoro.enabled;
  const state = pomodoro;
  if (!state || state.phase === 'idle') {
    pomodoroPhase.textContent = 'Ready';
    pomodoroTime.textContent = formatRemaining(settings.modes.pomodoro.intervalMin * 60_000);
    pomodoroToggle.textContent = 'Start focus';
    return;
  }
  pomodoroPhase.textContent = state.phase === 'focus' ? `Focus · round ${state.round + 1}` : 'Break';
  pomodoroTime.textContent = formatRemaining(state.endsAt - Date.now());
  pomodoroToggle.textContent = 'Stop';
}

async function render(): Promise<void> {
  const [settings, schedule, characters, bond, pomodoroState] = await Promise.all([
    getItem('settings'),
    getItem('schedule'),
    getItem('characters'),
    getItem('bond'),
    getItem('pomodoro'),
  ]);
  pomodoro = pomodoroState;
  enabledInput.checked = settings.enabled;
  fastInput.checked = settings.debugFastIntervals;
  if (settings.debugFastIntervals) debugPanel.hidden = false;
  statusText.textContent = describeNext(settings, schedule);

  const name = isDefaultCharacterId(characters.activeId)
    ? DEFAULT_CHARACTERS[characters.activeId].name
    : (characters.custom.find((c) => c.id === characters.activeId)?.name ?? 'Your buddy');
  moodText.textContent = `${name} ${MOOD_TEXT[moodFor(bondFor(bond, characters.activeId).affection)]}`;
  renderPomodoro(settings);
}

function parseScenario(value: string): DebugScenario {
  const [type, arg] = value.split(':');
  switch (type) {
    case 'mode':
      return { type: 'mode', mode: (MODE_IDS.find((id) => id === arg) ?? 'hydration') satisfies ModeId };
    case 'reaction':
      return { type: 'reaction', reaction: REACTION_KINDS.find((kind) => kind === arg) ?? 'codingWin' };
    case 'merged':
    case 'pomodoroBreak':
    case 'pomodoroEnd':
    case 'summary':
    case 'unlock':
      return { type };
    default:
      return { type: 'mode', mode: 'hydration' };
  }
}

enabledInput.addEventListener('change', () => {
  const enabled = enabledInput.checked;
  void updateItem('settings', (s) => ({ ...s, enabled }));
});

pomodoroToggle.addEventListener('click', () => {
  const running = pomodoro !== null && pomodoro.phase !== 'idle';
  void sendToBackground({ type: running ? 'pomodoro/stop' : 'pomodoro/start' });
});

settingsButton.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
  window.close();
});

fastInput.addEventListener('change', () => {
  const debugFastIntervals = fastInput.checked;
  void updateItem('settings', (s) => ({ ...s, debugFastIntervals }));
});

visitNowButton.addEventListener('click', async () => {
  debugMsg.textContent = 'Calling your buddy…';
  const result = await sendToBackground({ type: 'debug/visitNow', scenario: parseScenario(scenarioSelect.value) });
  debugMsg.textContent = result.ok ? (result.reason ?? 'On the way! Check the page.') : (result.reason ?? 'Could not visit.');
});

// Five clicks on the version label reveal the debug panel.
let versionClicks = 0;
versionLabel.addEventListener('click', () => {
  versionClicks += 1;
  if (versionClicks >= 5) debugPanel.hidden = false;
});
versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;

void chrome.commands.getAll().then((commands) => {
  const shortcut = commands.find((c) => c.name === 'hide-buddy')?.shortcut;
  shortcutLabel.textContent = shortcut ? `Hide buddy: ${shortcut}` : '';
});

onItemChanged('settings', () => void render());
onItemChanged('schedule', () => void render());
onItemChanged('pomodoro', () => void render());
onItemChanged('bond', () => void render());
void render();

// The popup may tick every second; only the service worker must avoid timers.
window.setInterval(() => {
  if (pomodoro && pomodoro.phase !== 'idle') pomodoroTime.textContent = formatRemaining(pomodoro.endsAt - Date.now());
}, 1000);
