/**
 * Renders one character (default SVG or uploaded images) and switches its
 * state. Used by the overlay and by the options page thumbnails. Styling
 * comes from assets/characters/characters.css, which the host must load.
 */
import { DEFAULT_CHARACTERS } from '@/assets/characters';
import { imageForState } from '@/lib/characters';
import type { CharacterRender, CharacterState } from '@/utils/types';

export class CharacterView {
  readonly element: HTMLDivElement;
  private readonly character: CharacterRender;
  private readonly img: HTMLImageElement | null = null;
  private currentSrc = '';

  constructor(character: CharacterRender, className = '') {
    this.character = character;
    this.element = document.createElement('div');
    this.element.className = `tb-char ${className}`.trim();
    if (character.kind === 'default') {
      // Our own constant markup, never user or page data.
      this.element.innerHTML = DEFAULT_CHARACTERS[character.id].svg;
    } else {
      this.element.classList.add('tb-custom');
      this.img = document.createElement('img');
      this.img.alt = '';
      this.img.draggable = false;
      this.element.append(this.img);
    }
    this.setState('idle');
  }

  setState(state: CharacterState): void {
    this.element.dataset.state = state;
    if (!this.img || this.character.kind !== 'custom') return;
    const image = imageForState(this.character.images, state);
    // Comparing our own copy avoids reading back a multi-MB img.src.
    if (image && image.src !== this.currentSrc) {
      this.currentSrc = image.src;
      this.img.src = image.src;
    }
    this.element.toggleAttribute('data-own', image?.own ?? false);
  }
}
