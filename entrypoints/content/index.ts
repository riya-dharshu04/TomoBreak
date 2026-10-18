/**
 * Content script. Stays dormant until the service worker asks for a visit:
 * it only registers two listeners, and builds DOM only while a visit plays.
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { onMessages, sendToBackground } from '@/lib/messaging';
import { Overlay } from '@/lib/overlay/overlay';
import { onItemChanged } from '@/lib/storage';
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

    onMessages<TabMessage>({
      'visit/show': ({ visit }) => {
        hide();
        const current = new Overlay(visit, {
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

    // Turning TomoBreak off in the popup hides the buddy at once, everywhere.
    const stopWatching = onItemChanged('settings', (settings) => {
      if (!settings.enabled) hide();
    });

    // Extension reloaded/updated: this script is orphaned, so clean up.
    ctx.onInvalidated(() => {
      stopWatching();
      hide();
    });
  },
});
