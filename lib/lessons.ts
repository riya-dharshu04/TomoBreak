/**
 * Language mode: picks the next word to teach.
 *
 * Each language keeps a cursor in storage. English walks its list in a
 * shuffled order without repeats (a stride coprime with the list length
 * visits every word once per round); Japanese goes in order from basic to
 * advanced words. After the last word, both start over.
 */
import { ENGLISH_WORDS, JAPANESE_WORDS } from '@/data/words';
import { getItem, updateItem } from '@/lib/storage';
import type { LessonLanguage, LessonWord } from '@/utils/types';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Index of the k-th word in a repeat-free shuffled walk through n words. */
function shuffledIndex(k: number, n: number): number {
  let stride = Math.max(1, Math.floor(n * 0.38));
  while (gcd(stride, n) !== 1) stride += 1;
  return (k * stride) % n;
}

function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`No word at ${index}`);
  return item;
}

/** The word taught at a given position for a language. */
export function wordAt(language: LessonLanguage, position: number): LessonWord {
  if (language === 'english') return at(ENGLISH_WORDS, shuffledIndex(position, ENGLISH_WORDS.length));
  return at(JAPANESE_WORDS, position % JAPANESE_WORDS.length);
}

/** Take the next word in the chosen language and move its cursor on. */
export async function nextLesson(): Promise<LessonWord> {
  const { language } = await getItem('settings');
  const state = await updateItem('lessons', (s) => ({ ...s, cursor: { ...s.cursor, [language]: s.cursor[language] + 1 } }));
  return wordAt(language, state.cursor[language] - 1);
}

/** The word that would come next, without using it up (for the preview). */
export async function peekLesson(language: LessonLanguage): Promise<LessonWord> {
  const { cursor } = await getItem('lessons');
  return wordAt(language, cursor[language]);
}
