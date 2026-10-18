import type { DefaultCharacterId } from '@/utils/types';
import { hanaSvg } from './hana';

export interface DefaultCharacter {
  id: DefaultCharacterId;
  name: string;
  /** Inline SVG markup using the shared tb-* part classes. */
  svg: string;
}

export const DEFAULT_CHARACTERS: Record<DefaultCharacterId, DefaultCharacter> = {
  hana: { id: 'hana', name: 'Hana', svg: hanaSvg },
};
