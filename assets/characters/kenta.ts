/**
 * Kenta: an original chibi boy with spiky hair and a red headband whose
 * tails flutter behind him (they use the tb-hair-swing animation).
 * Part classes are documented in hana.ts.
 */
import { characterSvg, faceParts } from './parts';

const HAIR = '#2f2a3a';
const SKIN = '#f6d2b4';
const SHIRT = '#ffb347';
const SHORTS = '#3f6fb5';
const SHOES = '#3a3a48';
const BAND = '#e8505b';
const BAND_DARK = '#c23a45';
const INK = '#2d2240';
const MOUTH = '#b8404f';

export const kentaSvg = characterSvg(`
    <g class="tb-hair-swing" data-origin="left">
      <path d="M88 38 C98 34 110 36 118 30 C114 40 104 44 92 44 Z" fill="${BAND}"/>
      <path d="M88 42 C100 44 108 52 114 60 C104 58 96 52 90 48 Z" fill="${BAND_DARK}"/>
    </g>
    <g class="tb-leg-l">
      <rect x="48" y="120" width="9" height="26" rx="4" fill="${SKIN}"/>
      <ellipse cx="52" cy="148" rx="7.5" ry="4" fill="${SHOES}"/>
    </g>
    <g class="tb-leg-r">
      <rect x="63" y="120" width="9" height="26" rx="4" fill="${SKIN}"/>
      <ellipse cx="68" cy="148" rx="7.5" ry="4" fill="${SHOES}"/>
    </g>
    <g class="tb-arm-l"><g transform="rotate(14 41 94)">
      <rect x="36" y="93" width="9" height="25" rx="4.5" fill="${SKIN}"/>
      <rect x="35" y="91" width="11" height="11" rx="4" fill="${SHIRT}"/>
      <circle cx="40.5" cy="119" r="5" fill="${SKIN}"/>
    </g></g>
    <g class="tb-arm-r"><g transform="rotate(-14 79 94)">
      <rect x="75" y="93" width="9" height="25" rx="4.5" fill="${SKIN}"/>
      <rect x="74" y="91" width="11" height="11" rx="4" fill="${SHIRT}"/>
      <circle cx="79.5" cy="119" r="5" fill="${SKIN}"/>
    </g></g>
    <path d="M45 90 Q60 85 75 90 L80 116 L40 116 Z" fill="${SHIRT}"/>
    <path d="M60 98 l2 4.5 5 .5 -3.8 3.3 1.2 4.9 -4.4 -2.6 -4.4 2.6 1.2 -4.9 -3.8 -3.3 5 -.5 Z" fill="#fff" opacity=".9"/>
    <path d="M40 114 L80 114 L82 128 L62 128 L60 122 L58 128 L38 128 Z" fill="${SHORTS}"/>
    <g class="tb-head">
      <path d="M25 58 C19 36 28 18 42 13 L46 4 L54 11 L62 2 L68 10 L78 5 L79 14 C93 21 101 38 95 58 Z" fill="${HAIR}"/>
      <ellipse cx="60" cy="57" rx="32" ry="30" fill="${SKIN}"/>
      <path d="M29 43 L91 43 L91 48 L85 46 L80 51 L74 45 L67 50 L61 45 L55 50 L48 45 L42 51 L36 45 L29 49 Z" fill="${HAIR}"/>
      <path d="M27 39 C40 30 80 30 93 39 L93 45 C80 36 40 36 27 45 Z" fill="${BAND}"/>
      <circle cx="91" cy="42" r="3.5" fill="${BAND_DARK}"/>
      ${faceParts({ ink: INK, mouth: MOUTH, brow: HAIR })}
    </g>`);
