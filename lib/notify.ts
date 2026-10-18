/**
 * System-notification fallback for pages where the overlay can't appear
 * (chrome:// pages, the Web Store, the PDF viewer) or when Chrome isn't the
 * focused app. Notifications allow two buttons, so: Yes / No, and closing
 * the notification counts as Snooze (like Escape on the bubble).
 */
import { dialogueFor, pick } from '@/data/dialogue';
import { MODES } from '@/lib/modes';
import type { Answer, Visit } from '@/utils/types';

const ICON_PATH = '/icons/128.png';

export async function showNotification(visit: Visit): Promise<boolean> {
  const mode = visit.modes[0] ?? 'hydration';
  const dialogue = dialogueFor(mode);
  try {
    await chrome.notifications.create(visit.id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL(ICON_PATH),
      title: `TomoBreak ${MODES[mode].emoji}`,
      message: pick(dialogue.prompt),
      buttons: [{ title: dialogue.buttons.yes }, { title: dialogue.buttons.no }],
      // Stays until answered; the visit timeout clears it after a minute.
      requireInteraction: true,
    });
    return true;
  } catch (error) {
    console.error('[TomoBreak] notification failed', error);
    return false;
  }
}

export function answerForButton(buttonIndex: number): Answer {
  return buttonIndex === 0 ? 'yes' : 'no';
}

export async function clearNotification(id: string): Promise<void> {
  await chrome.notifications.clear(id);
}

export async function clearAllNotifications(): Promise<void> {
  const all = await chrome.notifications.getAll();
  await Promise.all(Object.keys(all).map((id) => chrome.notifications.clear(id)));
}
