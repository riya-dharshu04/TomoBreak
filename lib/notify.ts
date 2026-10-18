/**
 * System-notification fallback for pages where the overlay can't appear
 * (chrome:// pages, the Web Store, the PDF viewer) or when Chrome isn't the
 * focused app. Notifications allow two buttons, so: Yes / No, and closing
 * the notification counts as Snooze (like Escape on the bubble).
 */
import { MERGED, POMODORO, dialogueFor, fill, mergedPrompt, pick } from '@/data/dialogue';
import { randomJoke } from '@/data/jokes';
import { randomStretch } from '@/data/stretches';
import { MODES } from '@/lib/modes';
import type { Answer, Visit } from '@/utils/types';

const ICON_PATH = '/icons/128.png';

interface NotificationContent {
  title: string;
  message: string;
  /** Labels for the Yes and No buttons; empty for an informational notification. */
  buttons: string[];
}

function contentFor(visit: Visit): NotificationContent {
  switch (visit.kind) {
    case 'pomodoroEnd':
      return { title: 'TomoBreak 🍅', message: pick(POMODORO.end), buttons: [POMODORO.endButtons.yes, POMODORO.endButtons.no] };
    case 'reaction':
      return { title: 'TomoBreak', message: 'Your buddy says hi!', buttons: [] };
    case 'reminder': {
      const { modes } = visit;
      const single = modes.length === 1 ? modes[0] : undefined;
      const question = single ? fill(pick(dialogueFor(single).prompt), { stretch: randomStretch().name }) : mergedPrompt(modes);
      const labels = single ? dialogueFor(single).buttons : MERGED.buttons;
      const buttons = modes.length > 0 ? [labels.yes, labels.no] : [];
      if (visit.pomodoroBreakMin !== null) {
        const start = fill(pick(POMODORO.breakStart), { min: String(visit.pomodoroBreakMin) });
        return { title: 'TomoBreak 🍅', message: modes.length > 0 ? `${start} ${question}` : start, buttons };
      }
      const emoji = single ? MODES[single].emoji : '💖';
      // A joke reads fine in a notification; the dance has to wait.
      const message = single === 'entertainment' ? randomJoke() : question;
      return { title: `TomoBreak ${emoji}`, message, buttons };
    }
  }
}

export async function showNotification(visit: Visit): Promise<boolean> {
  const content = contentFor(visit);
  try {
    await chrome.notifications.create(visit.id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL(ICON_PATH),
      title: content.title,
      message: content.message,
      buttons: content.buttons.map((title) => ({ title })),
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
