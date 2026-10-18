/**
 * Live preview: plays a real overlay visit inside the preview stage, so
 * what you see here is exactly what walks onto your pages.
 */
import { resolveCharacter } from '@/lib/characters';
import { Overlay } from '@/lib/overlay/overlay';
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
    const character = await resolveCharacter(characterId);
    if (generation !== this.generation) return;
    const visit: Visit = { id: crypto.randomUUID(), kind: 'preview', modes: [mode], characterId, entrance: 'walk' };
    const overlay = new Overlay(
      visit,
      character,
      {
        onAnswer: () => {
          // Preview answers are not recorded anywhere.
        },
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
