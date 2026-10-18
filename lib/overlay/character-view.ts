/**
 * Renders one built-in character and switches its state, pose, mood and
 * look. Used by the overlay and by the options page. Styling comes from
 * assets/characters/characters.css, which the host must load.
 */
import { DEFAULT_CHARACTERS } from '@/assets/characters';
import type { CharacterState, DefaultCharacterId, Mood, Pose, UnlockId } from '@/utils/types';

export class CharacterView {
  readonly element: HTMLDivElement;

  constructor(id: DefaultCharacterId, className = '') {
    this.element = document.createElement('div');
    this.element.className = `tb-char ${className}`.trim();
    // Our own constant markup, never user or page data.
    this.element.innerHTML = DEFAULT_CHARACTERS[id].svg;
    this.setState('idle');
  }

  setState(state: CharacterState): void {
    this.element.dataset.state = state;
  }

  /** Layer a body pose (posture, stretch, eye rest) over the state; null clears it. */
  setPose(pose: Pose | null): void {
    if (pose) this.element.dataset.pose = pose;
    else delete this.element.dataset.pose;
  }

  /** Mood changes the idle expression (see characters.css). */
  setMood(mood: Mood): void {
    this.element.dataset.mood = mood;
  }

  /** Wear unlocked streak rewards: the second dance and the party hat. */
  setLook(unlocks: readonly UnlockId[]): void {
    if (unlocks.includes('dance')) this.element.dataset.dance = '2';
    this.element.toggleAttribute('data-outfit', unlocks.includes('outfit'));
  }
}
