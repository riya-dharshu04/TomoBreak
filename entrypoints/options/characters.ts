/**
 * Step 1: the character picker.
 */
import { DEFAULT_CHARACTERS, DEFAULT_CHARACTER_IDS } from '@/assets/characters';
import { byId, el } from '@/lib/dom';
import { CharacterView } from '@/lib/overlay/character-view';
import type { DefaultCharacterId } from '@/utils/types';

export interface CharacterPickerEvents {
  /** The user picked a character. */
  onSelect: (id: DefaultCharacterId) => void;
}

export class CharacterPicker {
  private readonly grid = byId('character-grid', HTMLDivElement);
  private readonly events: CharacterPickerEvents;
  private selectedId: DefaultCharacterId;

  constructor(selectedId: DefaultCharacterId, events: CharacterPickerEvents) {
    this.selectedId = selectedId;
    this.events = events;
  }

  get selected(): DefaultCharacterId {
    return this.selectedId;
  }

  render(): void {
    this.grid.replaceChildren(...DEFAULT_CHARACTER_IDS.map((id) => this.card(id)));
  }

  select(id: DefaultCharacterId): void {
    this.selectedId = id;
    for (const input of this.grid.querySelectorAll<HTMLInputElement>('input[name="character"]')) {
      input.checked = input.value === id;
    }
    this.events.onSelect(id);
  }

  private card(id: DefaultCharacterId): HTMLElement {
    const { name, tagline } = DEFAULT_CHARACTERS[id];
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
    thumb.append(new CharacterView(id).element);
    label.append(input, thumb, el('span', 'char-name', name), el('span', 'char-tagline', tagline));
    return label;
  }
}
