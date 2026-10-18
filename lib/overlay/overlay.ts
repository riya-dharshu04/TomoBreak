/**
 * The on-page buddy. One instance = one visit.
 *
 * Renders into a single host element with a closed shadow root, so page CSS
 * can't reach it and page scripts can't poke at it. The host covers the
 * viewport with pointer-events: none; only the character and bubble accept
 * clicks. destroy() removes the host entirely, leaving no trace in the DOM.
 *
 * This class only provides the stage: walking in and out, the bubble,
 * buttons, timers and effects. What happens during a visit is scripted in
 * flows.ts.
 *
 * The options page reuses it for the live preview by passing a `container`:
 * the host then fills that element instead of the viewport.
 */
import characterCss from '@/assets/characters/characters.css?inline';
import type { Answer, AnswerOutcome, CharacterState, Pose, UnlockId, Visit } from '@/utils/types';
import { CharacterView } from './character-view';
import { ESCAPE, TIMEOUT, runVisit, type Choice, type Stage } from './flows';
import overlayCss from './overlay.css?inline';

const HOST_TAG = 'tomobreak-buddy';
/** Unanswered questions count as "ignored" after this long. */
const AUTO_DISMISS_MS = 60_000;
const WALK_PX_PER_S = 240;
const FADE_MS = 400;
/** Space kept between the bubble and the top of the page (or preview box). */
const BUBBLE_TOP_MARGIN = 8;
/** The bubble sits this far above the character, tail included. */
const BUBBLE_GAP = 20;
/** Share of the character that is visible during a gentle "peek" entrance. */
const PEEK_VISIBLE = 0.6;
const CONFETTI_PIECES = 28;
const CONFETTI_COLORS = ['#ff7aa2', '#ffc94d', '#7fd0ff', '#8d7ff0', '#7ee3a1'];

export interface OverlayCallbacks {
  /** Report the user's answer; resolves with any streak unlocks it earned. */
  onAnswer: (answer: Answer) => Promise<AnswerOutcome>;
  /** Called once, after the host element has been removed. */
  onClosed: () => void;
}

export interface OverlayOptions {
  /** Render inside this element instead of over the whole page (preview). */
  container?: HTMLElement;
  /** Move keyboard focus to the first button when the bubble opens. Default true. */
  autoFocus?: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class Overlay implements Stage {
  readonly visit: Visit;
  readonly reducedMotion: boolean;
  private readonly callbacks: OverlayCallbacks;
  private readonly container: HTMLElement | null;
  private readonly autoFocus: boolean;

  private readonly host: HTMLElement;
  private readonly layer: HTMLDivElement;
  private readonly buddy: HTMLDivElement;
  private readonly character: CharacterView;
  private readonly bubble: HTMLDivElement;
  private readonly text: HTMLParagraphElement;
  /** Holds a card (weekly summary) or a countdown timer under the text. */
  private readonly extra: HTMLDivElement;
  private readonly actions: HTMLDivElement;

  private readonly timers = new Set<number>();
  private readonly animations = new Set<Animation>();
  /** What Escape does right now (answer a question, skip a timer), if anything. */
  private escapeAction: (() => void) | null = null;
  private readonly look: UnlockId[];
  private previousFocus: Element | null = null;
  private destroyed = false;

  constructor(visit: Visit, callbacks: OverlayCallbacks, options: OverlayOptions = {}) {
    this.visit = visit;
    this.callbacks = callbacks;
    this.container = options.container ?? null;
    this.autoFocus = options.autoFocus ?? true;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.look = [...visit.unlocks];

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
    this.extra = el('div', 'extra');
    this.actions = el('div', 'actions');
    // Text and card scroll inside the body if the bubble runs out of room;
    // the buttons below always stay visible.
    const body = el('div', 'bubble-body');
    body.append(this.text, this.extra);
    this.bubble.append(body, this.actions);

    this.character = new CharacterView(visit.characterId, 'character');
    this.character.setMood(visit.mood);
    this.character.setLook(this.look);

    this.buddy.append(this.bubble, this.character.element);
    this.layer.append(this.buddy);
    root.append(style, this.layer);
  }

  /** Run the whole visit. Resolves when the buddy has left (or was destroyed). */
  async play(): Promise<void> {
    (this.container ?? document.documentElement).append(this.host);
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('resize', this.fitBubble);
    this.fitBubble();
    await this.enter();
    if (this.destroyed) return;
    await runVisit(this);
    if (this.destroyed) return;
    this.bubble.classList.remove('is-visible');
    this.setPose(null);
    await this.exit();
    this.destroy();
  }

  /** Remove everything immediately. Safe to call more than once. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('resize', this.fitBubble);
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

  // ---- Stage: character ---------------------------------------------------

  setState(state: CharacterState): void {
    this.character.setState(state);
  }

  setPose(pose: Pose | null): void {
    this.character.setPose(pose);
  }

  wear(unlock: UnlockId): void {
    if (!this.look.includes(unlock)) this.look.push(unlock);
    this.character.setLook(this.look);
  }

  confetti(): void {
    if (this.reducedMotion || this.destroyed) return;
    const burst = el('div', 'confetti');
    burst.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < CONFETTI_PIECES; i += 1) {
      const piece = el('span');
      // Random spread, set through CSSOM custom properties read by the keyframes.
      piece.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 260)}px`);
      piece.style.setProperty('--dy', `${Math.round(-80 - Math.random() * 140)}px`);
      piece.style.setProperty('--rot', `${Math.round(Math.random() * 720 - 360)}deg`);
      piece.style.setProperty('--delay', `${Math.round(Math.random() * 250)}ms`);
      piece.style.setProperty('--c', CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#ffc94d');
      burst.append(piece);
    }
    this.buddy.append(burst);
    this.later(() => burst.remove(), 2600);
  }

  // ---- Stage: bubble ------------------------------------------------------

  say(line: string): void {
    this.text.textContent = line;
    this.text.classList.remove('is-big');
    this.extra.replaceChildren();
    this.bubble.classList.add('is-visible');
  }

  showCard(title: string, rows: readonly string[], footer: string, bigTitle = false): void {
    this.say(title);
    this.text.classList.toggle('is-big', bigTitle);
    const list = el('ul', 'card-rows');
    for (const row of rows) list.append(el('li', '', row));
    this.extra.replaceChildren(list, el('p', 'card-footer', footer));
  }

  ask(choices: readonly Choice[], timeoutMs = AUTO_DISMISS_MS): Promise<string> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (id: string): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timerId);
        this.timers.delete(timerId);
        this.escapeAction = null;
        this.actions.replaceChildren();
        resolve(id);
      };
      const timerId = this.later(() => finish(TIMEOUT), timeoutMs);
      this.actions.replaceChildren(
        ...choices.map((choice) => {
          const button = el('button', choice.primary ? 'primary' : undefined, choice.label);
          button.type = 'button';
          button.addEventListener('click', () => finish(choice.id));
          return button;
        }),
      );
      this.escapeAction = () => finish(ESCAPE);
      this.focusFirstButton();
    });
  }

  /** Show a countdown with a skip button. Resolves true if it ran to the end. */
  countdown(seconds: number, skipLabel: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = el('div', 'timer');
      const number = el('span', 'timer-num', String(seconds));
      // The number changes every second; announcing each tick would be noise.
      number.setAttribute('aria-hidden', 'true');
      const bar = el('span', 'timer-bar');
      const fill = el('span', 'timer-fill');
      bar.append(fill);
      timer.append(number, bar);
      this.extra.replaceChildren(timer);
      this.bubble.classList.add('is-visible');

      const progress = fill.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
        duration: seconds * 1000,
        easing: 'linear',
        fill: 'forwards',
      });
      this.animations.add(progress);

      let remaining = seconds;
      let settled = false;
      const finish = (completed: boolean): void => {
        if (settled) return;
        settled = true;
        this.escapeAction = null;
        progress.cancel();
        this.animations.delete(progress);
        this.actions.replaceChildren();
        this.extra.replaceChildren();
        resolve(completed);
      };
      const tick = (): void => {
        if (settled) return;
        remaining -= 1;
        number.textContent = String(Math.max(0, remaining));
        if (remaining <= 0) finish(true);
        else this.later(tick, 1000);
      };
      this.later(tick, 1000);

      const skip = el('button', undefined, skipLabel);
      skip.type = 'button';
      skip.addEventListener('click', () => finish(false));
      this.actions.replaceChildren(skip);
      this.escapeAction = () => finish(false);
      this.focusFirstButton();
    });
  }

  report(answer: Answer): Promise<AnswerOutcome> {
    return this.callbacks.onAnswer(answer).catch((): AnswerOutcome => ({ unlocks: [] }));
  }

  /** Never resolves if destroyed first, which simply ends the flow. */
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.later(resolve, ms);
    });
  }

  private focusFirstButton(): void {
    if (!this.autoFocus) return;
    // Remember where focus was the first time we take it; restored on destroy.
    if (this.previousFocus === null && document.activeElement !== this.host) {
      this.previousFocus = document.activeElement;
    }
    this.actions.querySelector('button')?.focus({ preventScroll: true });
  }

  /**
   * Cap the bubble's height to the room above the character, so a tall card
   * (a word lesson, the weekly summary) is never cut off by the top of a
   * short window or the preview box.
   */
  private readonly fitBubble = (): void => {
    const room = this.buddy.offsetTop - BUBBLE_GAP - BUBBLE_TOP_MARGIN;
    this.bubble.style.setProperty('--tb-bubble-max', `${Math.max(140, room)}px`);
  };

  /** Escape answers Snooze / skips a timer. Only the Escape key is looked at. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.escapeAction) return;
    const focusInside = document.activeElement === this.host;
    // In the preview, Escape elsewhere on the options page is not for us.
    if (this.container && !focusInside) return;
    if (focusInside) event.stopPropagation();
    this.escapeAction();
  };

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

  // ---- Helpers ------------------------------------------------------------

  private later(callback: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, ms);
    this.timers.add(id);
    return id;
  }
}
