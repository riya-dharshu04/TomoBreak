/**
 * Hana: an original chibi girl with a ponytail. Drawn for TomoBreak.
 *
 * Every default character uses the same `tb-*` part classes so the shared
 * animations in characters.css work for all of them:
 *   tb-figure (whole body), tb-head, tb-arm-l/r, tb-leg-l/r, tb-hair-swing,
 *   eyes: tb-eyes-open | tb-eyes-happy | tb-eyes-closed | tb-eyes-sad | tb-eyes-wide
 *   mouths: tb-mouth-smile | tb-mouth-open | tb-mouth-sad | tb-mouth-o
 *   extras: tb-tear, tb-zzz, tb-sparkles
 * The face and extras come from parts.ts. Static rotations are applied on
 * inner <g>s because CSS animations replace the `transform` of the element
 * they run on.
 */
import { characterSvg, faceParts, partyHat } from './parts';

const HAIR = '#5b3a29';
const SKIN = '#ffe0c7';
const DRESS = '#7ec8e3';
const INK = '#2d2240';
const MOUTH = '#c2405a';

export const hanaSvg = characterSvg(`
    <g class="tb-hair-swing">
      <path d="M88 20 C118 14 124 52 114 80 C110 92 100 95 97 88 C108 70 106 44 90 34 Z" fill="${HAIR}"/>
      <circle cx="94" cy="21" r="5.5" fill="#ff7aa2"/>
    </g>
    <g class="tb-leg-l">
      <rect x="48" y="122" width="9" height="24" rx="4" fill="${SKIN}"/>
      <ellipse cx="52" cy="148" rx="7" ry="4" fill="#8a5a44"/>
    </g>
    <g class="tb-leg-r">
      <rect x="63" y="122" width="9" height="24" rx="4" fill="${SKIN}"/>
      <ellipse cx="68" cy="148" rx="7" ry="4" fill="#8a5a44"/>
    </g>
    <g class="tb-arm-l"><g transform="rotate(14 41 94)">
      <rect x="36" y="93" width="9" height="25" rx="4.5" fill="${DRESS}"/>
      <circle cx="40.5" cy="119" r="5" fill="${SKIN}"/>
    </g></g>
    <g class="tb-arm-r"><g transform="rotate(-14 79 94)">
      <rect x="75" y="93" width="9" height="25" rx="4.5" fill="${DRESS}"/>
      <circle cx="79.5" cy="119" r="5" fill="${SKIN}"/>
    </g></g>
    <path d="M45 90 Q60 85 75 90 L84 128 Q60 135 36 128 Z" fill="${DRESS}"/>
    <path d="M52 89 L60 97 L68 89 Q60 86 52 89 Z" fill="#fff"/>
    <g class="tb-head">
      <path d="M22 54 C20 22 42 10 60 10 C78 10 100 22 98 54 C98 70 93 80 88 86 L32 86 C27 80 22 70 22 54 Z" fill="${HAIR}"/>
      <ellipse cx="60" cy="57" rx="32" ry="30" fill="${SKIN}"/>
      <path d="M28 52 C29 27 45 18 60 18 C76 18 92 28 92 52 C85 42 77 37 70 35 C66 43 56 45 50 41 C45 47 36 51 28 52 Z" fill="${HAIR}"/>
      ${faceParts({ ink: INK, mouth: MOUTH, brow: HAIR })}
      ${partyHat(70, 16, 16)}
    </g>`);
