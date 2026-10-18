/**
 * SVG building blocks shared by every built-in character.
 *
 * All characters use a 120 x 160 viewBox with the face centred around
 * (60, 57), so the same eye/mouth shapes fit each of them. Each state in
 * characters.css shows one eye group and one mouth and hides the rest.
 *
 * Part classes used by the animations:
 *   tb-figure (whole body), tb-head, tb-arm-l/r, tb-leg-l/r, tb-hair-swing
 *   (pigtails or tail), eyes: tb-eyes-open | tb-eyes-happy | tb-eyes-closed |
 *   tb-eyes-sad | tb-eyes-wide, mouths: tb-mouth-smile | tb-mouth-open |
 *   tb-mouth-sad | tb-mouth-o, extras: tb-tear, tb-zzz, tb-sparkles, tb-hat,
 *   tb-snack (held while idle/walking).
 * Static rotations sit on inner <g>s because CSS animations replace the
 * `transform` of the element they run on.
 */

/** The resting smile: plain, a cat's "w", tongue out, or two buck teeth. */
export type SmileStyle = 'smile' | 'cat' | 'tongue' | 'buck';

export interface FaceOptions {
  ink: string;
  mouth: string;
  /** Eyebrow colour for the sad face. */
  brow: string;
  smile?: SmileStyle;
  /** Iris colour: big round sparkly eyes instead of bean eyes. */
  bigEyes?: string;
  /** Pupil colour; defaults to `ink`. Differs for dark fur with light lines. */
  pupil?: string;
}

const TONGUE = '#ff8fa3';

function restingSmile(style: SmileStyle, mouth: string): string {
  switch (style) {
    case 'smile':
      return `<path class="tb-mouth-smile" d="M54 72 Q60 77 66 72" fill="none" stroke="${mouth}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'cat':
      return `<path class="tb-mouth-smile" d="M53 71 Q56.5 75.5 60 71 Q63.5 75.5 67 71" fill="none" stroke="${mouth}" stroke-width="2" stroke-linecap="round"/>`;
    case 'tongue':
      return `<g class="tb-mouth-smile">
        <path d="M52 71 Q60 79 68 71 Z" fill="${mouth}"/>
        <path d="M58 74 Q57 84 62.5 84 Q67 83 65 74 Z" fill="${TONGUE}"/>
        <path d="M61.5 76 L61.5 81" stroke="#e46f86" stroke-width=".8" stroke-linecap="round"/>
      </g>`;
    case 'buck':
      return `<g class="tb-mouth-smile">
        <path d="M53 71 Q56.5 75 60 71 Q63.5 75 67 71" fill="none" stroke="${mouth}" stroke-width="2" stroke-linecap="round"/>
        <g fill="#fff" stroke="#d9cfc4" stroke-width=".6">
          <rect x="56.4" y="72.4" width="3.4" height="5.6" rx="1.1"/>
          <rect x="60.2" y="72.4" width="3.4" height="5.6" rx="1.1"/>
        </g>
      </g>`;
  }
}

function openEyes(ink: string, iris: string | undefined, pupil: string): string {
  if (!iris) {
    return `<g class="tb-eyes-open">
        <ellipse cx="47" cy="59" rx="4.5" ry="6" fill="${ink}"/><circle cx="48.6" cy="56.4" r="1.7" fill="#fff"/>
        <ellipse cx="73" cy="59" rx="4.5" ry="6" fill="${ink}"/><circle cx="74.6" cy="56.4" r="1.7" fill="#fff"/>
      </g>`;
  }
  const eye = (cx: number): string => `
        <ellipse cx="${cx}" cy="59" rx="7.2" ry="8.2" fill="${ink}"/>
        <ellipse cx="${cx}" cy="61.5" rx="5.4" ry="4.8" fill="${iris}"/>
        <ellipse cx="${cx}" cy="61.5" rx="2.2" ry="3.6" fill="${pupil}"/>
        <circle cx="${cx + 2.2}" cy="55.6" r="2.6" fill="#fff"/>
        <circle cx="${cx - 2.6}" cy="62.6" r="1.2" fill="#fff" opacity=".85"/>`;
  return `<g class="tb-eyes-open">${eye(46)}${eye(74)}</g>`;
}

/** Eyes, mouths, cheeks and the tear. Goes inside the character's tb-head. */
export function faceParts({ ink, mouth, brow, smile = 'smile', bigEyes, pupil = ink }: FaceOptions): string {
  return `
      <ellipse cx="39" cy="68" rx="5" ry="3" fill="#ff9bb3" opacity=".6"/>
      <ellipse cx="81" cy="68" rx="5" ry="3" fill="#ff9bb3" opacity=".6"/>

      ${openEyes(ink, bigEyes, pupil)}
      <g class="tb-eyes-happy" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round">
        <path d="M42 60 Q47 53 52 60"/><path d="M68 60 Q73 53 78 60"/>
      </g>
      <g class="tb-eyes-closed" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round">
        <path d="M42 59 Q47 63 52 59"/><path d="M68 59 Q73 63 78 59"/>
      </g>
      <g class="tb-eyes-sad">
        <ellipse cx="47" cy="61" rx="4" ry="5" fill="${ink}"/><circle cx="48.3" cy="59" r="1.4" fill="#fff"/>
        <ellipse cx="73" cy="61" rx="4" ry="5" fill="${ink}"/><circle cx="74.3" cy="59" r="1.4" fill="#fff"/>
        <path d="M41 52 L51 49 M69 49 L79 52" stroke="${brow}" stroke-width="2" stroke-linecap="round"/>
      </g>
      <g class="tb-eyes-wide">
        <circle cx="47" cy="59" r="6" fill="#fff" stroke="${ink}" stroke-width="1.5"/><circle cx="47" cy="59" r="3" fill="${pupil}"/>
        <circle cx="73" cy="59" r="6" fill="#fff" stroke="${ink}" stroke-width="1.5"/><circle cx="73" cy="59" r="3" fill="${pupil}"/>
      </g>

      ${restingSmile(smile, mouth)}
      <path class="tb-mouth-open" d="M53 71 Q60 81 67 71 Z" fill="${mouth}"/>
      <path class="tb-mouth-sad" d="M54 76 Q60 71 66 76" fill="none" stroke="${mouth}" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse class="tb-mouth-o" cx="60" cy="74" rx="3.5" ry="4.5" fill="${mouth}"/>

      <path class="tb-tear" d="M77 66 q3 5 0 7 q-3 -2 0 -7 Z" fill="#7fd0ff"/>`;
}

/** Whiskers on both sides of the muzzle, centred on (60, y). */
export function whiskers(y: number, color: string): string {
  return `<path d="M40 ${y - 2} L20 ${y - 6} M40 ${y + 1} L19 ${y + 1} M40 ${y + 4} L21 ${y + 8} M80 ${y - 2} L100 ${y - 6} M80 ${y + 1} L101 ${y + 1} M80 ${y + 4} L99 ${y + 8}"
        stroke="${color}" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>`;
}

export const FRECKLES = `<g fill="#c47a5a" opacity=".65">
        <circle cx="37" cy="64" r="1"/><circle cx="41" cy="66" r="1"/><circle cx="36" cy="68" r="1"/>
        <circle cx="83" cy="64" r="1"/><circle cx="79" cy="66" r="1"/><circle cx="84" cy="68" r="1"/>
      </g>`;

/** A little band-aid stuck on the left cheek. */
export const BANDAID = `<g transform="rotate(-30 36 64)">
        <rect x="29" y="61" width="14" height="5.5" rx="2.7" fill="#f6cfa6" stroke="#d9a77c" stroke-width=".6"/>
        <rect x="34" y="61" width="4" height="5.5" fill="#ecb98a"/>
      </g>`;

/**
 * Party hat: the 7-day streak outfit. Hidden unless the character has
 * `data-outfit`. (x, y) is the centre of the hat's brim on the head.
 */
export function partyHat(x: number, y: number, tilt: number): string {
  return `
      <g class="tb-hat" transform="translate(${x} ${y}) rotate(${tilt})">
        <path d="M-11 0 L0 -24 L11 0 Z" fill="#ff7aa2"/>
        <path d="M-7.5 -8 L7.5 -8 M-4 -16 L4 -16" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="3" fill="#6c5ce7"/>
        <circle cx="0" cy="-25" r="3.5" fill="#ffc94d"/>
      </g>`;
}

/** Floating z's (sleepy) and sparkles (happy). Last children of tb-figure. */
const EXTRAS = `
    <g class="tb-zzz" fill="#8a7fd0" font-family="system-ui, sans-serif" font-weight="700">
      <text x="14" y="26" font-size="12">z</text><text x="6" y="16" font-size="9">z</text>
    </g>
    <g class="tb-sparkles" fill="#ffc94d">
      <path d="M14 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z"/>
      <path d="M104 96 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"/>
    </g>`;

/** Wrap a character's body parts in the shared SVG frame. */
export function characterSvg(body: string): string {
  return `
<svg class="tb-svg" viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <ellipse class="tb-shadow" cx="60" cy="154" rx="26" ry="4" fill="#000" opacity=".15"/>
  <g class="tb-figure">${body}${EXTRAS}
  </g>
</svg>`;
}
