/** The built-in characters: original artwork drawn as inline SVG. */
import type { DefaultCharacterId } from '@/utils/types';
import { boySvg } from './boy';
import { catSvg } from './cat';
import { dogSvg } from './dog';
import { girlSvg } from './girl';
import { hamsterSvg } from './hamster';

export interface DefaultCharacter {
  id: DefaultCharacterId;
  name: string;
  /** Short personality line for the character picker. */
  tagline: string;
  /** Inline SVG markup using the shared tb-* part classes (see parts.ts). */
  svg: string;
}

export const DEFAULT_CHARACTER_IDS: readonly DefaultCharacterId[] = ['hamster', 'cat', 'dog', 'girl', 'boy'];

export const DEFAULT_CHARACTERS: Record<DefaultCharacterId, DefaultCharacter> = {
  hamster: { id: 'hamster', name: 'Hamster', tagline: 'Chubby, cheeky snack hoarder', svg: hamsterSvg },
  cat: { id: 'cat', name: 'Cat', tagline: 'A curious black kitten', svg: catSvg },
  dog: { id: 'dog', name: 'Dog', tagline: 'A goofy, happy puppy', svg: dogSvg },
  girl: { id: 'girl', name: 'Girl', tagline: 'Sweet, sunny and full of energy', svg: girlSvg },
  boy: { id: 'boy', name: 'Boy', tagline: 'Brave, bouncy and a bit clumsy', svg: boySvg },
};
