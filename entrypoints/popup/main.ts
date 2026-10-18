import { byId } from '@/lib/dom';
import { formatMinutes, isInQuietHours } from '@/lib/focus';
import { sendToBackground } from '@/lib/messaging';
import { MODE_IDS, MODES } from '@/lib/modes';
import { getItem, onItemChanged, updateItem } from '@/lib/storage';
import type { ScheduleState, Settings } from '@/utils/types';

const enabledInput = byId('enabled', HTMLInputElement);
const statusText = byId('status', HTMLParagraphElement);
const debugPanel = byId('debug', HTMLElement);
const fastInput = byId('fast', HTMLInputElement);
const visitNowButton = byId('visit-now', HTMLButtonElement);
const debugMsg = byId('debug-msg', HTMLParagraphElement);
const versionLabel = byId('version', HTMLSpanElement);
const settingsButton = byId('open-settings', HTMLButtonElement);

function describeNext(settings: Settings, schedule: ScheduleState): string {
  if (!settings.enabled) return 'Your buddy is resting. Turn visits on to get reminders.';
  if (schedule.activeVisit) return 'Your buddy is visiting right now!';
  const { quietHours } = settings;
  if (isInQuietHours(quietHours, Date.now())) return `Quiet hours until ${formatMinutes(quietHours.endMin)}. Rest well!`;
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

async function render(): Promise<void> {
  const [settings, schedule] = await Promise.all([getItem('settings'), getItem('schedule')]);
  enabledInput.checked = settings.enabled;
  fastInput.checked = settings.debugFastIntervals;
  if (settings.debugFastIntervals) debugPanel.hidden = false;
  statusText.textContent = describeNext(settings, schedule);
}

enabledInput.addEventListener('change', () => {
  const enabled = enabledInput.checked;
  void updateItem('settings', (s) => ({ ...s, enabled }));
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
  const result = await sendToBackground({ type: 'debug/visitNow' });
  debugMsg.textContent = result.ok ? 'On the way! Check the page.' : (result.reason ?? 'Could not visit.');
});

// Five clicks on the version label reveal the debug panel.
let versionClicks = 0;
versionLabel.addEventListener('click', () => {
  versionClicks += 1;
  if (versionClicks >= 5) debugPanel.hidden = false;
});
versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;

onItemChanged('settings', () => void render());
onItemChanged('schedule', () => void render());
void render();
