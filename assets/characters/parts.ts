/**
 * SVG building blocks shared by every default character.
 *
 * All characters use a 120 x 160 viewBox with the face centred around
 * (60, 57), so the same eye/mouth shapes fit each of them. Each state in
 * characters.css shows one eye group and one mouth and hides the rest.
 */

export interface FaceColors {
  ink: string;
  mouth: string;
  /** Eyebrow colour for the sad face. */
  brow: string;
}

/** Eyes, mouths, cheeks and the tear. Goes inside the character's tb-head. */
export function faceParts({ ink, mouth, brow }: FaceColors): string {
  return `
      <ellipse cx="40" cy="67" rx="5" ry="3" fill="#ff9bb3" opacity=".6"/>
      <ellipse cx="80" cy="67" rx="5" ry="3" fill="#ff9bb3" opacity=".6"/>

      <g class="tb-eyes-open">
        <ellipse cx="47" cy="59" rx="4.5" ry="6" fill="${ink}"/><circle cx="48.6" cy="56.4" r="1.7" fill="#fff"/>
        <ellipse cx="73" cy="59" rx="4.5" ry="6" fill="${ink}"/><circle cx="74.6" cy="56.4" r="1.7" fill="#fff"/>
      </g>
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
        <circle cx="47" cy="59" r="6" fill="#fff" stroke="${ink}" stroke-width="1.5"/><circle cx="47" cy="59" r="3" fill="${ink}"/>
        <circle cx="73" cy="59" r="6" fill="#fff" stroke="${ink}" stroke-width="1.5"/><circle cx="73" cy="59" r="3" fill="${ink}"/>
      </g>

      <path class="tb-mouth-smile" d="M54 72 Q60 77 66 72" fill="none" stroke="${mouth}" stroke-width="2.2" stroke-linecap="round"/>
      <path class="tb-mouth-open" d="M53 71 Q60 81 67 71 Z" fill="${mouth}"/>
      <path class="tb-mouth-sad" d="M54 76 Q60 71 66 76" fill="none" stroke="${mouth}" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse class="tb-mouth-o" cx="60" cy="74" rx="3.5" ry="4.5" fill="${mouth}"/>

      <path class="tb-tear" d="M77 66 q3 5 0 7 q-3 -2 0 -7 Z" fill="#7fd0ff"/>`;
}

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
