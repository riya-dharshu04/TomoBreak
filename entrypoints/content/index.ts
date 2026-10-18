/**
 * Content script. Stays light until the service worker asks for a visit:
 * it registers a few passive listeners for throttled activity reports, and
 * builds DOM only while a visit plays.
 *
 * It deliberately does not subscribe to chrome.storage changes: every tab
 * would then receive each change, including multi-MB character uploads.
 * The service worker sends `visit/hide` instead when TomoBreak is turned off.
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { resolveCharacter } from '@/lib/characters';
import { onMessages, sendToBackground } from '@/lib/messaging';
import { ActivityTracker } from '@/lib/overlay/activity';
import { Overlay } from '@/lib/overlay/overlay';
import type { TabMessage } from '@/utils/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main(ctx) {
    let overlay: Overlay | null = null;

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

    onMessages<TabMessage>({
      'visit/show': async ({ visit }) => {
        // Last-moment checks only the page itself can make.
        if (document.fullscreenElement) return { ok: false, reason: 'fullscreen' };
        if (activity.isTyping()) return { ok: false, reason: 'typing' };
        hide();
        const character = await resolveCharacter(visit.characterId);
        const current = new Overlay(visit, character, {
          onAnswer: (answer) => {
            sendToBackground({ type: 'visit/answer', visitId: visit.id, answer }).catch(() => {
              // Extension reloaded mid-visit; the SW's timeout alarm cleans up.
            });
          },
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
      hide();
    });
  },
});
