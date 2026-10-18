import { updateItem } from '@/lib/storage';
import type { Answer, AnswerCounts, ModeId } from '@/utils/types';

/** Local calendar date as `YYYY-MM-DD` (stats follow the user's day, not UTC). */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function emptyCounts(): AnswerCounts {
  return { yes: 0, no: 0, snooze: 0, ignored: 0 };
}

export async function recordAnswer(mode: ModeId, answer: Answer): Promise<void> {
  const key = dayKey();
  await updateItem('stats', (stats) => {
    const day = { ...stats.days[key] };
    const counts = { ...(day[mode] ?? emptyCounts()) };
    counts[answer] += 1;
    day[mode] = counts;
    return { ...stats, days: { ...stats.days, [key]: day } };
  });
}
