/**
 * Service worker: owns scheduling and routes messages.
 * All listeners are registered synchronously so Chrome can wake the worker
 * for them after it has been stopped.
 */
import { defineBackground } from 'wxt/utils/define-background';
import { handleActivity, handleAlarm, handleIdleState, showNow, tryDeliver } from '@/lib/delivery';
import { IDLE_DETECTION_S } from '@/lib/focus';
import { onMessages, sendToTab } from '@/lib/messaging';
import { answerForButton, clearAllNotifications } from '@/lib/notify';
import { handleAnswer, syncSchedules } from '@/lib/scheduler';
import { ensureInitialized, getItem, onItemChanged } from '@/lib/storage';
import type { BackgroundMessage } from '@/utils/types';

function logError(error: unknown): void {
  console.error('[TomoBreak]', error);
}

async function init(): Promise<void> {
  await ensureInitialized();
  await syncSchedules();
}

async function openOnboarding(): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL('/options.html?welcome=1') });
}

/** Turned off: remove the buddy from every tab and any notification at once. */
async function hideEverywhere(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((tab) =>
      tab.id === undefined ? undefined : sendToTab(tab.id, { type: 'visit/hide' }).catch(() => undefined),
    ),
  );
  await clearAllNotifications();
}

export default defineBackground(() => {
  chrome.idle.setDetectionInterval(IDLE_DETECTION_S);

  chrome.runtime.onInstalled.addListener((details) => {
    init()
      .then(() => (details.reason === 'install' ? openOnboarding() : undefined))
      .catch(logError);
  });
  chrome.runtime.onStartup.addListener(() => {
    init().catch(logError);
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    handleAlarm(alarm).catch(logError);
  });

  // Toggles and interval changes from the popup/options take effect at once.
  onItemChanged('settings', (next, previous) => {
    if (previous?.enabled && !next.enabled) hideEverywhere().catch(logError);
    syncSchedules().catch(logError);
  });

  // ---- Natural pauses ----
  chrome.tabs.onActivated.addListener(() => {
    tryDeliver('tabSwitch').catch(logError);
  });
  chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
    if (change.status === 'complete' && tab.active) tryDeliver('navigation').catch(logError);
  });
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) tryDeliver('windowFocus').catch(logError);
  });
  chrome.idle.onStateChanged.addListener((state) => {
    handleIdleState(state).catch(logError);
  });

  // ---- Notification fallback ----
  chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
    handleAnswer(id, answerForButton(buttonIndex)).catch(logError);
  });
  chrome.notifications.onClosed.addListener((id, byUser) => {
    // Dismissed by the user = Snooze. Answered or timed-out notifications are
    // cleared by us after the visit ended, so handleAnswer ignores them.
    if (byUser) handleAnswer(id, 'snooze').catch(logError);
  });

  onMessages<BackgroundMessage>({
    'visit/answer': async ({ visitId, answer }) => {
      await handleAnswer(visitId, answer);
      return { ok: true };
    },
    'activity/ping': async ({ typing }, sender) => {
      const settings = await getItem('settings');
      if (settings.enabled) await handleActivity(typing, sender);
      return { ok: true };
    },
    'debug/visitNow': () => showNow(),
  });
});
