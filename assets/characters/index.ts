import type { DefaultCharacterId } from '@/utils/types';
import { hanaSvg } from './hana';
import { kentaSvg } from './kenta';
import { kitsuSvg } from './kitsu';

export interface DefaultCharacter {
  id: DefaultCharacterId;
  name: string;
  /** Short personality line for the character picker. */
  tagline: string;
  /** Inline SVG markup using the shared tb-* part classes. */
  svg: string;
}

export const DEFAULT_CHARACTER_IDS: readonly DefaultCharacterId[] = ['hana', 'kenta', 'kitsu'];

export const DEFAULT_CHARACTERS: Record<DefaultCharacterId, DefaultCharacter> = {
  hana: { id: 'hana', name: 'Hana', tagline: 'Cheerful and caring', svg: hanaSvg },
  kenta: { id: 'kenta', name: 'Kenta', tagline: 'Your energetic coach', svg: kentaSvg },
  kitsu: { id: 'kitsu', name: 'Kitsu', tagline: 'A playful fox spirit', svg: kitsuSvg },
};
