/**
 * Activity reporting from the page to the service worker.
 *
 * Listens for keydown, input, scroll and pointer events and tells the
 * service worker "the user is active" (and whether that included typing) at
 * most once every 5 seconds. It never looks at which key was pressed, what
 * was typed or anything else on the page: the event type is all it uses.
 */

const THROTTLE_MS = 5_000;
/** A focused text field counts as "typing right now" for this long after a key. */
const TYPING_BUSY_MS = 10_000;

const TYPING_EVENTS = ['keydown', 'input'] as const;
const PRESENCE_EVENTS = ['scroll', 'wheel', 'pointermove', 'pointerdown'] as const;
const LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, passive: true };

/** `<input>` types that take free text. */
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

function deepActiveElement(): Element | null {
  let active = document.activeElement;
  // Follow focus into open shadow roots (closed ones hide it, which is fine).
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function isEditable(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
  if (element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(element.type) && !element.readOnly && !element.disabled;
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

export class ActivityTracker {
  private readonly report: (typing: boolean) => void;
  private lastSentAt = 0;
  private lastTypingAt = 0;
  private typedSinceReport = false;
  private timer: number | null = null;

  constructor(report: (typing: boolean) => void) {
    this.report = report;
  }

  start(): void {
    for (const type of TYPING_EVENTS) window.addEventListener(type, this.onTyping, LISTENER_OPTIONS);
    for (const type of PRESENCE_EVENTS) window.addEventListener(type, this.onPresence, LISTENER_OPTIONS);
  }

  stop(): void {
    for (const type of TYPING_EVENTS) window.removeEventListener(type, this.onTyping, LISTENER_OPTIONS);
    for (const type of PRESENCE_EVENTS) window.removeEventListener(type, this.onPresence, LISTENER_OPTIONS);
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  /** True while the user is typing into a focused text field or editor. */
  isTyping(): boolean {
    return Date.now() - this.lastTypingAt < TYPING_BUSY_MS && isEditable(deepActiveElement());
  }

  private readonly onTyping = (): void => {
    this.lastTypingAt = Date.now();
    this.typedSinceReport = true;
    this.schedule();
  };

  private readonly onPresence = (): void => {
    this.schedule();
  };

  /** Report now if the last report is old enough, else once the 5 s window ends. */
  private schedule(): void {
    if (this.timer !== null) return;
    const wait = this.lastSentAt + THROTTLE_MS - Date.now();
    if (wait <= 0) this.flush();
    else this.timer = window.setTimeout(this.flush, wait);
  }

  private readonly flush = (): void => {
    this.timer = null;
    this.lastSentAt = Date.now();
    const typing = this.typedSinceReport;
    this.typedSinceReport = false;
    this.report(typing);
  };
}
