/** Character lookup. The built-in characters are the only ones. */
import { DEFAULT_CHARACTERS } from '@/assets/characters';
import type { DefaultCharacterId } from '@/utils/types';

/** Shown whenever the chosen character can't be found. */
export const FALLBACK_CHARACTER: DefaultCharacterId = 'hamster';

export function isDefaultCharacterId(id: string): id is DefaultCharacterId {
  return Object.hasOwn(DEFAULT_CHARACTERS, id);
}

/** A stored or received id as a known character; anything else becomes the hamster. */
export function toCharacterId(id: string): DefaultCharacterId {
  return isDefaultCharacterId(id) ? id : FALLBACK_CHARACTER;
}
