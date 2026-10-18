/**
 * Step 1: the character picker and the custom upload form.
 */
import { DEFAULT_CHARACTERS, DEFAULT_CHARACTER_IDS } from '@/assets/characters';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_STATES,
  UPLOAD_TYPES,
  addCustomCharacter,
  deleteCustomCharacter,
  getCharacterImages,
  hasAnyImage,
} from '@/lib/characters';
import { byId, el } from '@/lib/dom';
import { CharacterView } from '@/lib/overlay/character-view';
import { getItem } from '@/lib/storage';
import type { CharacterImages, CharacterRender, UploadState } from '@/utils/types';

const STATE_LABELS: Record<UploadState, string> = {
  idle: 'Idle',
  walk: 'Walking',
  happy: 'Happy',
  sad: 'Sad',
};

export interface CharacterPickerEvents {
  /** The user picked a character (or one was added/removed). */
  onSelect: (id: string) => void;
}

export class CharacterPicker {
  private readonly grid = byId('character-grid', HTMLDivElement);
  private readonly events: CharacterPickerEvents;
  private selectedId: string;

  constructor(selectedId: string, events: CharacterPickerEvents) {
    this.selectedId = selectedId;
    this.events = events;
  }

  get selected(): string {
    return this.selectedId;
  }

  /** Rebuild the grid from storage (defaults first, then uploads). */
  async render(): Promise<void> {
    const store = await getItem('characters');
    if (!DEFAULT_CHARACTER_IDS.some((id) => id === this.selectedId) && !store.custom.some((c) => c.id === this.selectedId)) {
      this.selectedId = 'hana';
    }
    const cards: HTMLElement[] = DEFAULT_CHARACTER_IDS.map((id) =>
      this.card(id, DEFAULT_CHARACTERS[id].name, DEFAULT_CHARACTERS[id].tagline, { kind: 'default', id }, false),
    );
    for (const custom of store.custom) {
      const images = await getCharacterImages(custom.id);
      if (!hasAnyImage(images)) continue;
      cards.push(this.card(custom.id, custom.name, 'Uploaded by you', { kind: 'custom', id: custom.id, images }, true));
    }
    this.grid.replaceChildren(...cards);
  }

  select(id: string): void {
    this.selectedId = id;
    for (const input of this.grid.querySelectorAll<HTMLInputElement>('input[name="character"]')) {
      input.checked = input.value === id;
    }
    this.events.onSelect(id);
  }

  private card(id: string, name: string, tagline: string, render: CharacterRender, removable: boolean): HTMLElement {
    const card = el('div', 'char-card');
    const label = el('label', 'char-option');
    const input = el('input');
    input.type = 'radio';
    input.name = 'character';
    input.value = id;
    input.className = 'sr-only';
    input.checked = id === this.selectedId;
    input.addEventListener('change', () => {
      if (input.checked) this.select(id);
    });

    const thumb = el('span', 'char-thumb');
    thumb.append(new CharacterView(render).element);
    label.append(input, thumb, el('span', 'char-name', name), el('span', 'char-tagline', tagline));
    card.append(label);

    if (removable) {
      const remove = el('button', 'char-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Delete ${name}`);
      remove.addEventListener('click', () => void this.remove(id, name));
      card.append(remove);
    }
    return card;
  }

  private async remove(id: string, name: string): Promise<void> {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await deleteCustomCharacter(id);
    if (this.selectedId === id) this.selectedId = 'hana';
    await this.render();
    this.events.onSelect(this.selectedId);
  }
}

// ---------------------------------------------------------------------------
// Upload form
// ---------------------------------------------------------------------------

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unexpected reader result'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function validate(file: File): string | null {
  if (!UPLOAD_TYPES.includes(file.type)) return `"${file.name}" isn't a PNG, GIF or WebP image.`;
  if (file.size > MAX_UPLOAD_BYTES) return `"${file.name}" is larger than 2 MB.`;
  return null;
}

export class UploadForm {
  private readonly panel = byId('upload-panel', HTMLDetailsElement);
  private readonly nameInput = byId('upload-name', HTMLInputElement);
  private readonly slots = byId('upload-slots', HTMLDivElement);
  private readonly error = byId('upload-error', HTMLParagraphElement);
  private readonly saveButton = byId('upload-save', HTMLButtonElement);
  private readonly onSaved: (id: string) => Promise<void>;
  private images: CharacterImages = {};

  constructor(onSaved: (id: string) => Promise<void>) {
    this.onSaved = onSaved;
    this.buildSlots();
    this.saveButton.addEventListener('click', () => void this.save());
  }

  private buildSlots(): void {
    const accept = UPLOAD_TYPES.join(',');
    this.slots.replaceChildren(
      ...UPLOAD_STATES.map((state) => {
        const slot = el('div', 'slot');
        const label = el('label', 'slot-pick');
        const preview = el('span', 'slot-thumb');
        const img = el('img');
        img.alt = '';
        img.hidden = true;
        preview.append(img, el('span', 'slot-plus', '+'));
        const input = el('input');
        input.type = 'file';
        input.accept = accept;
        input.className = 'sr-only';
        label.append(input, preview, el('span', 'slot-name', STATE_LABELS[state]));

        const clear = el('button', 'slot-clear', 'Remove');
        clear.type = 'button';
        clear.hidden = true;
        clear.addEventListener('click', () => {
          delete this.images[state];
          input.value = '';
          img.hidden = true;
          img.removeAttribute('src');
          clear.hidden = true;
          this.refresh();
        });
        input.addEventListener('change', () => {
          void this.pick(state, input, img).then((hasImage) => {
            clear.hidden = !hasImage;
          });
        });
        slot.append(label, clear);
        return slot;
      }),
    );
  }

  /** Validate and load the chosen file. Resolves to whether the slot now has an image. */
  private async pick(state: UploadState, input: HTMLInputElement, img: HTMLImageElement): Promise<boolean> {
    const file = input.files?.[0];
    if (!file) return this.images[state] !== undefined;
    const problem = validate(file);
    if (problem) {
      this.error.textContent = problem;
      input.value = '';
      return this.images[state] !== undefined;
    }
    this.error.textContent = '';
    const dataUrl = await readAsDataUrl(file);
    this.images[state] = dataUrl;
    img.src = dataUrl;
    img.hidden = false;
    this.refresh();
    return true;
  }

  private refresh(): void {
    this.saveButton.disabled = !hasAnyImage(this.images);
  }

  private async save(): Promise<void> {
    if (!hasAnyImage(this.images)) return;
    this.saveButton.disabled = true;
    try {
      const name = this.nameInput.value.trim() || 'My buddy';
      const character = await addCustomCharacter(name, this.images);
      this.images = {};
      this.nameInput.value = 'My buddy';
      this.buildSlots();
      this.panel.open = false;
      await this.onSaved(character.id);
    } catch (error) {
      console.error('[TomoBreak] could not save character', error);
      this.error.textContent = 'Could not save this character. Please try again.';
      this.refresh();
    }
  }
}
