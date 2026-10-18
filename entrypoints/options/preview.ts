/**
 * Live preview: plays a real overlay visit inside the preview stage, so
 * what you see here is exactly what walks onto your pages.
 */
import { bondFor, moodFor } from '@/lib/bond';
import { peekLesson } from '@/lib/lessons';
import { Overlay } from '@/lib/overlay/overlay';
import { getItem } from '@/lib/storage';
import type { DefaultCharacterId, LessonLanguage, ModeId, Visit, VisitBody } from '@/utils/types';

export class Preview {
  private readonly stage: HTMLElement;
  private overlay: Overlay | null = null;
  /** Bumped on every play() so a slow storage read can't start a stale visit. */
  private generation = 0;

  constructor(stage: HTMLElement) {
    this.stage = stage;
  }

  async play(characterId: DefaultCharacterId, mode: ModeId, language: LessonLanguage): Promise<void> {
    const generation = ++this.generation;
    this.stop();
    const [bondStore, word] = await Promise.all([getItem('bond'), peekLesson(language)]);
    if (generation !== this.generation) return;
    const bond = bondFor(bondStore, characterId);
    const body: VisitBody =
      mode === 'language'
        ? { kind: 'lesson', word }
        : {
            kind: 'reminder',
            // Pomodoro has no reminder of its own: preview its break visit instead.
            modes: mode === 'pomodoro' ? [] : [mode],
            pomodoroBreakMin: mode === 'pomodoro' ? 5 : null,
          };
    const visit: Visit = {
      ...body,
      id: crypto.randomUUID(),
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
