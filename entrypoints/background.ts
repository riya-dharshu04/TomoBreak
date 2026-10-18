/**
 * Service worker: owns scheduling and routes messages.
 * All listeners are registered synchronously so Chrome can wake the worker
 * for them after it has been stopped.
 */
import { defineBackground } from 'wxt/utils/define-background';
import { onMessages } from '@/lib/messaging';
import { handleAlarm, handleAnswer, showVisit, syncSchedules } from '@/lib/scheduler';
import { ensureInitialized, onItemChanged } from '@/lib/storage';
import type { BackgroundMessage } from '@/utils/types';

function logError(error: unknown): void {
  console.error('[TomoBreak]', error);
}

async function init(): Promise<void> {
  await ensureInitialized();
  await syncSchedules();
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    init().catch(logError);
  });
  chrome.runtime.onStartup.addListener(() => {
    init().catch(logError);
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    handleAlarm(alarm).catch(logError);
  });

  // Toggles and interval changes from the popup/options take effect at once.
  onItemChanged('settings', () => {
    syncSchedules().catch(logError);
  });

  onMessages<BackgroundMessage>({
    'visit/answer': async ({ visitId, answer }) => {
      await handleAnswer(visitId, answer);
      return { ok: true };
    },
    'debug/visitNow': () => showVisit(['hydration']),
  });
});
