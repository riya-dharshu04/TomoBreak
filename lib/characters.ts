/**
 * Character store helpers: default characters, uploads and lookup.
 *
 * Uploaded images are data URLs kept in chrome.storage.local (the
 * unlimitedStorage permission lifts the quota). Each upload's images get
 * their own key so loading the active character reads only that one.
 */
import { DEFAULT_CHARACTERS } from '@/assets/characters';
import { updateItem } from '@/lib/storage';
import type {
  CharacterImages,
  CharacterImagesKey,
  CharacterRender,
  CharacterState,
  CustomCharacter,
  DefaultCharacterId,
  UploadState,
} from '@/utils/types';

export const UPLOAD_STATES: readonly UploadState[] = ['idle', 'walk', 'happy', 'sad'];
export const UPLOAD_TYPES: readonly string[] = ['image/png', 'image/gif', 'image/webp'];
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** Shown whenever the chosen character can't be found. */
export const FALLBACK_CHARACTER: DefaultCharacterId = 'hana';

export function isDefaultCharacterId(id: string): id is DefaultCharacterId {
  return Object.hasOwn(DEFAULT_CHARACTERS, id);
}

function imagesKey(id: string): CharacterImagesKey {
  return `charimg:${id}`;
}

/** Keep only well-formed image data URLs from whatever is stored. */
function toImages(value: unknown): CharacterImages {
  const images: CharacterImages = {};
  if (typeof value !== 'object' || value === null) return images;
  for (const state of UPLOAD_STATES) {
    const src: unknown = (value as Record<string, unknown>)[state];
    if (typeof src === 'string' && src.startsWith('data:image/')) images[state] = src;
  }
  return images;
}

export function hasAnyImage(images: CharacterImages): boolean {
  return UPLOAD_STATES.some((state) => images[state] !== undefined);
}

export async function getCharacterImages(id: string): Promise<CharacterImages> {
  const key = imagesKey(id);
  const result = await chrome.storage.local.get(key);
  return toImages(result[key]);
}

export async function addCustomCharacter(name: string, images: CharacterImages): Promise<CustomCharacter> {
  const character: CustomCharacter = { id: `custom-${crypto.randomUUID()}`, name, createdAt: Date.now() };
  // Images first: a character listed in the store always has its images.
  await chrome.storage.local.set({ [imagesKey(character.id)]: images });
  await updateItem('characters', (store) => ({ ...store, custom: [...store.custom, character] }));
  return character;
}

export async function deleteCustomCharacter(id: string): Promise<void> {
  await updateItem('characters', (store) => ({
    activeId: store.activeId === id ? FALLBACK_CHARACTER : store.activeId,
    custom: store.custom.filter((character) => character.id !== id),
  }));
  await chrome.storage.local.remove(imagesKey(id));
}

/** Load what the overlay needs; unknown or broken uploads fall back to Hana. */
export async function resolveCharacter(id: string): Promise<CharacterRender> {
  if (isDefaultCharacterId(id)) return { kind: 'default', id };
  const images = await getCharacterImages(id);
  return hasAnyImage(images) ? { kind: 'custom', id, images } : { kind: 'default', id: FALLBACK_CHARACTER };
}

export interface StateImage {
  src: string;
  /** True when the user uploaded an image for exactly this state. */
  own: boolean;
}

/**
 * Image for a state. talk/sleepy/surprised reuse idle. Missing images fall
 * back to idle, then to any upload; CSS effects then fake the state.
 */
export function imageForState(images: CharacterImages, state: CharacterState): StateImage | null {
  const wanted: UploadState = state === 'walk' || state === 'happy' || state === 'sad' ? state : 'idle';
  const own = images[wanted];
  if (own !== undefined) return { src: own, own: true };
  const fallback = images.idle ?? images.walk ?? images.happy ?? images.sad;
  return fallback === undefined ? null : { src: fallback, own: false };
}
