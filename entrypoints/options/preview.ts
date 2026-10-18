/**
 * Live preview: plays a real overlay visit inside the preview stage, so
 * what you see here is exactly what walks onto your pages.
 */
import { bondFor, moodFor } from '@/lib/bond';
import { resolveCharacter } from '@/lib/characters';
import { Overlay } from '@/lib/overlay/overlay';
import { getItem } from '@/lib/storage';
import type { ModeId, Visit } from '@/utils/types';

export class Preview {
  private readonly stage: HTMLElement;
  private overlay: Overlay | null = null;
  /** Bumped on every play() so a slow character load can't start a stale visit. */
  private generation = 0;

  constructor(stage: HTMLElement) {
    this.stage = stage;
  }

  async play(characterId: string, mode: ModeId): Promise<void> {
    const generation = ++this.generation;
    this.stop();
    const [character, bondStore] = await Promise.all([resolveCharacter(characterId), getItem('bond')]);
    if (generation !== this.generation) return;
    const bond = bondFor(bondStore, characterId);
    const visit: Visit = {
      id: crypto.randomUUID(),
      kind: 'reminder',
      // Pomodoro has no reminder of its own: preview its break visit instead.
      modes: mode === 'pomodoro' ? [] : [mode],
      pomodoroBreakMin: mode === 'pomodoro' ? 5 : null,
      characterId,
      entrance: 'walk',
      preview: true,
      mood: moodFor(bond.affection),
      unlocks: bond.unlocks,
      announce: [],
      summary: null,
    };
    const overlay = new Overlay(
      visit,
      character,
      {
        // Preview answers are not recorded anywhere.
        onAnswer: () => Promise.resolve({ unlocks: [] }),
        onClosed: () => {
          if (this.overlay === overlay) this.overlay = null;
        },
      },
      // Don't steal focus from the form control the user just changed.
      { container: this.stage, autoFocus: false },
    );
    this.overlay = overlay;
    void overlay.play();
  }

  stop(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }
}
