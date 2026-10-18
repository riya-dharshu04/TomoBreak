/**
 * Boy: a little boy with a short spiky haircut swept to one side, a band-aid
 * on his cheek, a green hoodie and red sneakers. Original artwork.
 */
import { BANDAID, characterSvg, faceParts, partyHat } from './parts';

const SKIN = '#f5c9a3';
const EAR_IN = '#e8a986';
const HAIR = '#3b2a20';
const HOODIE = '#4cc38a';
const HOODIE_DARK = '#37a673';
const SHORTS = '#2f4b7c';
const SHOES = '#ff6b6b';
const INK = '#2a1d17';
const MOUTH = '#b8404f';

export const boySvg = characterSvg(`
    <g class="tb-leg-l">
      <rect x="48" y="122" width="9" height="24" rx="4" fill="${SKIN}"/>
      <ellipse cx="52" cy="148" rx="8" ry="4.5" fill="${SHOES}"/>
      <path d="M45 150 L59 150" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
    </g>
    <g class="tb-leg-r">
      <rect x="63" y="122" width="9" height="24" rx="4" fill="${SKIN}"/>
      <ellipse cx="68" cy="148" rx="8" ry="4.5" fill="${SHOES}"/>
      <path d="M61 150 L75 150" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
    </g>
    <g class="tb-arm-l"><g transform="rotate(14 41 94)">
      <rect x="36" y="93" width="9" height="25" rx="4.5" fill="${HOODIE}"/>
      <circle cx="40.5" cy="119" r="5" fill="${SKIN}"/>
    </g></g>
    <g class="tb-arm-r"><g transform="rotate(-14 79 94)">
      <rect x="75" y="93" width="9" height="25" rx="4.5" fill="${HOODIE}"/>
      <circle cx="79.5" cy="119" r="5" fill="${SKIN}"/>
    </g></g>
    <path d="M45 89 Q60 84 75 89 L80 118 L40 118 Z" fill="${HOODIE}"/>
    <path d="M47 89 Q60 98 73 89 Q60 85 47 89 Z" fill="${HOODIE_DARK}"/>
    <path d="M56 93 L55 103 M64 93 L65 103" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M48 106 L72 106 L70 116 L50 116 Z" fill="${HOODIE_DARK}"/>
    <path d="M40 116 L80 116 L82 128 L62 128 L60 122 L58 128 L38 128 Z" fill="${SHORTS}"/>
    <g class="tb-head">
      <ellipse cx="28.5" cy="61" rx="5.5" ry="7.5" fill="${SKIN}"/><ellipse cx="29" cy="61" rx="2.6" ry="4.2" fill="${EAR_IN}"/>
      <ellipse cx="91.5" cy="61" rx="5.5" ry="7.5" fill="${SKIN}"/><ellipse cx="91" cy="61" rx="2.6" ry="4.2" fill="${EAR_IN}"/>
      <ellipse cx="60" cy="57" rx="32" ry="30" fill="${SKIN}"/>
      <path d="M29 54 C25 34 36 17 53 14 L56 7 L62 12.5 L69 6 L72.5 13.5 L81 11 L80.5 19 C90 26 95 38 91 54 L88.5 54 C88.5 46 85.5 41 80.5 39 C72 45.5 60 46.5 50 40 C44 43.5 38 44.5 34 42.5 C32.5 46 32 50 31.5 54 Z" fill="${HAIR}"/>
      ${faceParts({ ink: INK, mouth: MOUTH, brow: HAIR })}
      ${BANDAID}
      ${partyHat(70, 12, 16)}
    </g>`);
