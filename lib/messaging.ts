import type { AnyMessage, BackgroundMessage, ResponseOf, TabMessage } from '@/utils/types';

/** Send a message to the service worker and get its typed response. */
export function sendToBackground<M extends BackgroundMessage>(message: M): Promise<ResponseOf<M>> {
  return chrome.runtime.sendMessage<M, ResponseOf<M>>(message);
}

/**
 * Send a message to a tab's content script. Rejects when the tab has no
 * receiver (chrome:// pages, Web Store, not yet injected), which callers use
 * to detect that the overlay cannot appear there.
 */
export function sendToTab<M extends TabMessage>(tabId: number, message: M): Promise<ResponseOf<M>> {
  return chrome.tabs.sendMessage<M, ResponseOf<M>>(tabId, message);
}

type Handler<M extends AnyMessage> = (
  message: M,
  sender: chrome.runtime.MessageSender,
) => ResponseOf<M> | Promise<ResponseOf<M>>;

/** One handler per message type of the union U; the compiler enforces completeness. */
export type HandlerMap<U extends AnyMessage> = {
  [K in U['type']]: Handler<Extract<U, { type: K }>>;
};

function hasType(value: unknown): value is { type: string } {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

/**
 * Register typed handlers. Messages whose type is not in the map are left for
 * other listeners. Handlers may be async; the response is sent when it settles.
 */
export function onMessages<U extends AnyMessage>(handlers: HandlerMap<U>): void {
  chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    if (!hasType(raw) || !Object.hasOwn(handlers, raw.type)) return false;
    // The map is keyed by `type`, so the handler found matches the message.
    const handler = handlers[raw.type as U['type']] as unknown as Handler<U>;
    Promise.resolve()
      .then(() => handler(raw as U, sender))
      .then(sendResponse, (error: unknown) => {
        console.error('[TomoBreak] message handler failed', raw.type, error);
        sendResponse(undefined);
      });
    return true; // keep the channel open for the async response
  });
}
