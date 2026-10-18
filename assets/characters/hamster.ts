/**
 * Hamster: an extra-chubby orange hamster with puffy stuffed cheeks, two big
 * buck teeth and a tuft of hair that won't lie flat, hugging a sunflower
 * seed (tb-snack, put away while talking, dancing or posing). Only little
 * feet peek out from under the round body. Original artwork.
 */
import { characterSvg, faceParts, partyHat, whiskers } from './parts';

const FUR = '#f4a65c';
const FUR_DARK = '#df8a3a';
const CREAM = '#fff1de';
const EAR_IN = '#ffb8b0';
const PAW = '#ffc9c0';
const SEED = '#3d3a40';
const SEED_STRIPE = '#ece6da';
const INK = '#2a1d17';
const MOUTH = '#b8404f';

export const hamsterSvg = characterSvg(`
    <g class="tb-leg-l"><ellipse cx="47" cy="145" rx="9" ry="5.5" fill="${PAW}"/></g>
    <g class="tb-leg-r"><ellipse cx="73" cy="145" rx="9" ry="5.5" fill="${PAW}"/></g>
    <ellipse cx="60" cy="112" rx="34" ry="31" fill="${FUR}"/>
    <ellipse cx="60" cy="118" rx="24" ry="22" fill="${CREAM}"/>
    <g class="tb-head">
      <circle cx="35" cy="32" r="9.5" fill="${FUR_DARK}"/><circle cx="35.5" cy="33" r="5.5" fill="${EAR_IN}"/>
      <circle cx="85" cy="32" r="9.5" fill="${FUR_DARK}"/><circle cx="84.5" cy="33" r="5.5" fill="${EAR_IN}"/>
      <path d="M55 30 C52 20 59 14 61 22 C63 13 72 16 66 29 Z" fill="${FUR_DARK}"/>
      <ellipse cx="60" cy="56" rx="32" ry="27" fill="${FUR}"/>
      <ellipse cx="30" cy="73" rx="20" ry="16" fill="${FUR}"/>
      <ellipse cx="90" cy="73" rx="20" ry="16" fill="${FUR}"/>
      <ellipse cx="30" cy="77" rx="13" ry="9" fill="${CREAM}"/>
      <ellipse cx="90" cy="77" rx="13" ry="9" fill="${CREAM}"/>
      <ellipse cx="60" cy="71" rx="12" ry="9" fill="${CREAM}"/>
      <ellipse cx="60" cy="66" rx="2.8" ry="2" fill="#ff8fa3"/>
      ${whiskers(68, '#8a6a52')}
      ${faceParts({ ink: INK, mouth: MOUTH, brow: FUR_DARK, smile: 'buck' })}
      ${partyHat(60, 30, 0)}
    </g>
    <g class="tb-snack">
      <path d="M60 92 C67 96 68 109 60 116 C52 109 53 96 60 92 Z" fill="${SEED}"/>
      <path d="M57 97 L57 110 M63 97 L63 110" stroke="${SEED_STRIPE}" stroke-width="1.6" stroke-linecap="round"/>
    </g>
    <g class="tb-arm-l"><g transform="rotate(-40 42 100)">
      <rect x="38" y="98" width="8" height="13" rx="4" fill="${FUR}"/>
      <ellipse cx="42" cy="111" rx="4.6" ry="3.6" fill="${PAW}"/>
    </g></g>
    <g class="tb-arm-r"><g transform="rotate(40 78 100)">
      <rect x="74" y="98" width="8" height="13" rx="4" fill="${FUR}"/>
      <ellipse cx="78" cy="111" rx="4.6" ry="3.6" fill="${PAW}"/>
    </g></g>`);
