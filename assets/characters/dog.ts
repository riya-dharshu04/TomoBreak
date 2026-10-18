/**
 * Dog: a brown puppy with long floppy ears, a wide snout with a big
 * shiny nose, a dark patch over one eye, tan "eyebrow" dots, tongue out and
 * a sky-blue bandana. Original artwork.
 */
import { characterSvg, faceParts, partyHat } from './parts';

const FUR = '#a86b3c';
const FUR_DARK = '#6e4529';
/** The eye patch: darker than the fur but light enough for the eye to show. */
const PATCH = '#8a5631';
const MUZZLE = '#f3dcc0';
const TAN = '#e7b781';
const NOSE = '#2a1d17';
const BANDANA = '#4cc9f0';
const INK = '#2a1d17';
const MOUTH = '#8e3a46';

export const dogSvg = characterSvg(`
    <g class="tb-hair-swing" data-origin="base">
      <path d="M77 120 C90 119 100 106 98 92 C101 88 107 92 106 99 C105 112 96 124 84 127 C80 127 77 125 77 120 Z" fill="${FUR}"/>
    </g>
    <g class="tb-leg-l">
      <rect x="47" y="120" width="11" height="22" rx="5" fill="${FUR}"/>
      <ellipse cx="52.5" cy="145" rx="7.5" ry="4.8" fill="${MUZZLE}"/>
    </g>
    <g class="tb-leg-r">
      <rect x="62" y="120" width="11" height="22" rx="5" fill="${FUR}"/>
      <ellipse cx="67.5" cy="145" rx="7.5" ry="4.8" fill="${MUZZLE}"/>
    </g>
    <g class="tb-arm-l"><g transform="rotate(16 42 96)">
      <rect x="37" y="94" width="10" height="20" rx="5" fill="${FUR}"/>
      <circle cx="42" cy="115" r="5" fill="${MUZZLE}"/>
    </g></g>
    <g class="tb-arm-r"><g transform="rotate(-16 78 96)">
      <rect x="73" y="94" width="10" height="20" rx="5" fill="${FUR}"/>
      <circle cx="78" cy="115" r="5" fill="${MUZZLE}"/>
    </g></g>
    <ellipse cx="60" cy="111" rx="24" ry="22" fill="${FUR}"/>
    <ellipse cx="60" cy="115" rx="14" ry="15" fill="${MUZZLE}"/>
    <path d="M41 89 Q60 97 79 89 L60 111 Z" fill="${BANDANA}"/>
    <g fill="#fff" opacity=".85"><circle cx="54" cy="96" r="1.4"/><circle cx="64" cy="97" r="1.4"/><circle cx="59" cy="103" r="1.4"/></g>
    <g class="tb-head">
      <ellipse cx="60" cy="57" rx="34" ry="29" fill="${FUR}"/>
      <ellipse cx="74.5" cy="56" rx="10" ry="9" fill="${PATCH}"/>
      <path d="M33 30 C18 26 9 46 13 70 C15 82 27 82 30 72 C33 60 36 44 33 30 Z" fill="${FUR_DARK}"/>
      <path d="M87 30 C102 26 111 46 107 70 C105 82 93 82 90 72 C87 60 84 44 87 30 Z" fill="${FUR_DARK}"/>
      <ellipse cx="60" cy="73" rx="18" ry="12.5" fill="${MUZZLE}"/>
      <ellipse cx="46" cy="47" rx="3.6" ry="2.6" fill="${TAN}"/>
      <ellipse cx="74" cy="46" rx="3.6" ry="2.6" fill="${TAN}"/>
      <ellipse cx="60" cy="66.5" rx="6.4" ry="4.4" fill="${NOSE}"/>
      <ellipse cx="58" cy="65" rx="2" ry="1" fill="#fff" opacity=".55"/>
      ${faceParts({ ink: INK, mouth: MOUTH, brow: FUR_DARK, smile: 'tongue' })}
      ${partyHat(60, 29, 0)}
    </g>`);
