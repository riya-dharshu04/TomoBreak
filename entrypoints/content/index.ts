/**
 * Content script. Stays light until the service worker asks for a visit:
 * it registers a few passive listeners for throttled activity reports, and
 * builds DOM only while a visit plays. On a few coding sites it also runs a
 * site adapter that watches for results.
 *
 * It deliberately does not subscribe to chrome.storage changes: every tab
 * would then be woken by each settings, stats or schedule write. The service
 * worker sends `visit/hide` instead when TomoBreak is turned off.
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { adapterFor } from '@/lib/adapters';
import { toCharacterId } from '@/lib/characters';
import { onMessages, sendToBackground } from '@/lib/messaging';
import { ActivityTracker } from '@/lib/overlay/activity';
import { Overlay } from '@/lib/overlay/overlay';
import { getItem } from '@/lib/storage';
import type { TabMessage } from '@/utils/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main(ctx) {
    let overlay: Overlay | null = null;
    let stopAdapter: (() => void) | null = null;

    const hide = (): void => {
      overlay?.destroy();
      overlay = null;
    };

    const activity = new ActivityTracker((typing) => {
      if (ctx.isInvalid) return;
      sendToBackground({ type: 'activity/ping', typing }).catch(() => {
        // Service worker restarting or extension reloaded; the next ping retries.
      });
    });
    activity.start();

    // Site adapter (LeetCode, GitHub): only on its sites, only if enabled.
    // Settings are read once; toggling takes effect on the next page load.
    const adapter = adapterFor(location.hostname);
    if (adapter) {
      void getItem('settings').then((settings) => {
        if (ctx.isInvalid || !settings.enabled || !settings.reactions.codingWins) return;
        stopAdapter = adapter.start((event) => {
          if (ctx.isInvalid) return;
          sendToBackground({ type: 'adapter/event', event }).catch(() => undefined);
        });
      });
    }

    onMessages<TabMessage>({
      'visit/show': async ({ visit }) => {
        // Last-moment checks only the page itself can make.
        if (document.fullscreenElement) return { ok: false, reason: 'fullscreen' };
        if (activity.isTyping()) return { ok: false, reason: 'typing' };
        hide();
        // Unknown ids (e.g. from an older version) fall back to a built-in character.
        const current = new Overlay({ ...visit, characterId: toCharacterId(visit.characterId) }, {
          onAnswer: (answer) => sendToBackground({ type: 'visit/answer', visitId: visit.id, answer }),
          onClosed: () => {
            if (overlay === current) overlay = null;
          },
        });
        overlay = current;
        void current.play();
        return { ok: true };
      },
      'visit/hide': () => {
        hide();
        return { ok: true };
      },
    });

    // Extension reloaded/updated: this script is orphaned, so clean up.
    ctx.onInvalidated(() => {
      activity.stop();
      stopAdapter?.();
      hide();
    });
  },
});
