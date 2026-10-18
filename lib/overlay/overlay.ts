/**
 * The on-page buddy. One instance = one visit.
 *
 * Renders into a single host element with a closed shadow root, so page CSS
 * can't reach it and page scripts can't poke at it. The host covers the
 * viewport with pointer-events: none; only the character and bubble accept
 * clicks. destroy() removes the host entirely, leaving no trace in the DOM.
 *
 * The options page reuses it for the live preview by passing a `container`:
 * the host then fills that element instead of the viewport.
 */
import characterCss from '@/assets/characters/characters.css?inline';
import { dialogueFor, pick, type ModeDialogue } from '@/data/dialogue';
import type { Answer, CharacterRender, CharacterState, Visit } from '@/utils/types';
import { CharacterView } from './character-view';
import overlayCss from './overlay.css?inline';

const HOST_TAG = 'tomobreak-buddy';
const AUTO_DISMISS_MS = 60_000;
const WALK_PX_PER_S = 240;
const FADE_MS = 400;
/** Share of the character that is visible during a gentle "peek" entrance. */
const PEEK_VISIBLE = 0.6;

export interface OverlayCallbacks {
  /** Called once, as soon as the user answers (before the reaction plays). */
  onAnswer: (answer: Answer) => void;
  /** Called once, after the host element has been removed. */
  onClosed: () => void;
}

export interface OverlayOptions {
  /** Render inside this element instead of over the whole page (preview). */
  container?: HTMLElement;
  /** Move keyboard focus to the first button when the bubble opens. Default true. */
  autoFocus?: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export class Overlay {
  private readonly visit: Visit;
  private readonly callbacks: OverlayCallbacks;
  private readonly container: HTMLElement | null;
  private readonly autoFocus: boolean;
  private readonly dialogue: ModeDialogue;
  private readonly reducedMotion: boolean;

  private readonly host: HTMLElement;
  private readonly layer: HTMLDivElement;
  private readonly buddy: HTMLDivElement;
  private readonly character: CharacterView;
  private readonly bubble: HTMLDivElement;
  private readonly text: HTMLParagraphElement;
  private readonly actions: HTMLDivElement;

  private readonly timers = new Set<number>();
  private readonly animations = new Set<Animation>();
  private previousFocus: Element | null = null;
  private answered = false;
  private destroyed = false;

  constructor(visit: Visit, character: CharacterRender, callbacks: OverlayCallbacks, options: OverlayOptions = {}) {
    this.visit = visit;
    this.callbacks = callbacks;
    this.container = options.container ?? null;
    this.autoFocus = options.autoFocus ?? true;
    // Merged multi-mode dialogue arrives in Phase 4; until then use the first.
    this.dialogue = dialogueFor(visit.modes[0] ?? 'hydration');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.host = document.createElement(HOST_TAG);
    if (this.container) this.host.setAttribute('data-embedded', '');
    // Inline !important beats any page rule that targets our tag.
    for (const [prop, value] of [
      ['position', this.container ? 'absolute' : 'fixed'],
      ['inset', '0'],
      ['z-index', this.container ? '1' : '2147483647'],
      ['pointer-events', 'none'],
      ['display', 'block'],
    ] as const) {
      this.host.style.setProperty(prop, value, 'important');
    }
    const root = this.host.attachShadow({ mode: 'closed' });

    const style = el('style');
    style.textContent = `${overlayCss}\n${characterCss}`;

    this.layer = el('div', 'layer');
    this.buddy = el('div', visit.entrance === 'peek' ? 'buddy is-peek' : 'buddy');
    this.bubble = el('div', 'bubble');
    this.bubble.setAttribute('role', 'dialog');
    this.bubble.setAttribute('aria-label', 'TomoBreak buddy');
    this.text = el('p', 'text');
    // Screen readers announce each new line the buddy says.
    this.text.setAttribute('aria-live', 'polite');
    this.actions = el('div', 'actions');
    this.bubble.append(this.text, this.actions);

    this.character = new CharacterView(character, 'character');

    this.buddy.append(this.bubble, this.character.element);
    this.layer.append(this.buddy);
    root.append(style, this.layer);
  }

  /** Run the whole visit. Resolves when the buddy has left (or was destroyed). */
  async play(): Promise<void> {
    (this.container ?? document.documentElement).append(this.host);
    await this.enter();
    if (this.destroyed) return;

    this.setState('talk');
    this.say(pick(this.dialogue.prompt));
    this.showButtons();
    window.addEventListener('keydown', this.onKeyDown, true);
    this.later(() => void this.answer('ignored'), AUTO_DISMISS_MS);
  }

  /** Remove everything immediately. Safe to call more than once. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown, true);
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
    // With a closed shadow root, focus inside it shows up as the host itself.
    const hadFocus = document.activeElement === this.host;
    this.host.remove();
    if (hadFocus && this.previousFocus instanceof HTMLElement) {
      this.previousFocus.focus({ preventScroll: true });
    }
    this.callbacks.onClosed();
  }

  // ---- Flow ---------------------------------------------------------------

  private async answer(answer: Answer): Promise<void> {
    if (this.answered || this.destroyed) return;
    this.answered = true;
    window.removeEventListener('keydown', this.onKeyDown, true);
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    this.actions.replaceChildren();
    this.callbacks.onAnswer(answer);

    await this.react(answer);
    if (this.destroyed) return;
    this.bubble.classList.remove('is-visible');
    await this.exit();
    this.destroy();
  }

  private async react(answer: Answer): Promise<void> {
    const d = this.dialogue;
    switch (answer) {
      case 'yes':
        this.setState('happy');
        this.say(pick(d.yes));
        await this.wait(5000);
        return;
      case 'no':
        this.setState('sad');
        this.say(pick(d.no));
        await this.wait(1800);
        if (d.noFollowUp) {
          this.setState('talk');
          this.say(d.noFollowUp);
          await this.wait(2500);
        }
        return;
      case 'snooze':
        this.setState('idle');
        this.say(pick(d.snooze));
        await this.wait(2200);
        return;
      case 'ignored':
        this.setState('sleepy');
        this.say(pick(d.ignored));
        await this.wait(2200);
        return;
    }
  }

  // ---- Movement -----------------------------------------------------------

  private stageWidth(): number {
    return this.layer.clientWidth || window.innerWidth;
  }

  /** X offset where the buddy stops: the centre, or just inside the right edge. */
  private restX(): number {
    const width = this.buddy.offsetWidth;
    if (this.visit.entrance === 'peek') return Math.round(this.stageWidth() - width * PEEK_VISIBLE);
    return Math.round(this.stageWidth() / 2 - width / 2);
  }

  private async enter(): Promise<void> {
    const target = this.restX();
    this.buddy.style.transform = `translateX(${target}px)`;
    if (this.reducedMotion) {
      await this.animate([{ opacity: 0 }, { opacity: 1 }], FADE_MS);
      return;
    }
    const start = this.stageWidth() + 10;
    // A peek is a slow, quiet slide rather than a walk.
    if (this.visit.entrance === 'peek') {
      this.setState('idle');
      await this.animate(
        [{ transform: `translateX(${start}px)` }, { transform: `translateX(${target}px)` }],
        1200,
        'ease-out',
      );
      return;
    }
    this.setState('walk');
    await this.animate(
      [{ transform: `translateX(${start}px)` }, { transform: `translateX(${target}px)` }],
      this.walkDuration(start - target),
      'ease-out',
    );
  }

  private async exit(): Promise<void> {
    const from = this.restX();
    if (this.reducedMotion) {
      await this.animate([{ opacity: 1 }, { opacity: 0 }], FADE_MS, 'linear', 'forwards');
      return;
    }
    const to = this.stageWidth() + 10;
    this.setState('walk');
    await this.animate(
      [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
      this.walkDuration(to - from),
      'ease-in',
      'forwards',
    );
  }

  private walkDuration(distancePx: number): number {
    return Math.min(4500, Math.max(1500, (distancePx / WALK_PX_PER_S) * 1000));
  }

  /** Web Animations wrapper; resolves when finished or cancelled by destroy(). */
  private async animate(
    keyframes: Keyframe[],
    duration: number,
    easing = 'linear',
    fill: FillMode = 'none',
  ): Promise<void> {
    if (this.destroyed) return;
    const animation = this.buddy.animate(keyframes, { duration, easing, fill });
    this.animations.add(animation);
    try {
      await animation.finished;
    } catch {
      // Cancelled (destroy() was called); nothing to do.
    } finally {
      this.animations.delete(animation);
    }
  }

  // ---- Bubble -------------------------------------------------------------

  private say(line: string): void {
    this.text.textContent = line;
    this.bubble.classList.add('is-visible');
  }

  private showButtons(): void {
    const { buttons } = this.dialogue;
    const specs: { answer: Answer; label: string; primary: boolean }[] = [
      { answer: 'yes', label: buttons.yes, primary: true },
      { answer: 'no', label: buttons.no, primary: false },
      { answer: 'snooze', label: buttons.snooze, primary: false },
    ];
    for (const spec of specs) {
      const button = el('button', spec.primary ? 'primary' : undefined);
      button.type = 'button';
      button.textContent = spec.label;
      button.addEventListener('click', () => void this.answer(spec.answer));
      this.actions.append(button);
    }
    if (!this.autoFocus) return;
    // Move focus to the bubble so it is keyboard usable; restored on destroy.
    this.previousFocus = document.activeElement;
    this.actions.querySelector('button')?.focus({ preventScroll: true });
  }

  /** Escape = Snooze. Only the Escape key is looked at; nothing is recorded. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    const focusInside = document.activeElement === this.host;
    // In the preview, Escape elsewhere on the options page is not for us.
    if (this.container && !focusInside) return;
    if (focusInside) event.stopPropagation();
    void this.answer('snooze');
  };

  // ---- Helpers ------------------------------------------------------------

  private setState(state: CharacterState): void {
    this.character.setState(state);
  }

  private later(callback: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, ms);
    this.timers.add(id);
  }

  /** Never resolves if destroyed first, which simply ends the flow. */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.later(resolve, ms));
  }
}
