/**
 * Girl: a little girl with bouncy pigtails held by yellow star clips,
 * freckles, a pink dress with a heart and purple shoes. Original artwork.
 */
import { FRECKLES, characterSvg, faceParts, partyHat } from './parts';

const SKIN = '#ffe0c7';
const HAIR = '#7a3b2e';
const DRESS = '#ff7aa2';
const DRESS_LIGHT = '#ffd1e0';
const CLIP = '#ffd23f';
const SHOES = '#8c6cf0';
const INK = '#2a1d17';
const MOUTH = '#c2405a';

/** Five-pointed star centred on (cx, cy). */
function star(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  });
  return `<polygon points="${points.join(' ')}" fill="${CLIP}" stroke="#e8b400" stroke-width=".6" stroke-linejoin="round"/>`;
}

export const girlSvg = characterSvg(`
    <g class="tb-hair-swing" data-origin="top">
      <path d="M90 40 C108 38 116 56 110 74 C106 82 98 80 98 74 C104 62 100 50 90 48 Z" fill="${HAIR}"/>
      <path d="M30 40 C12 38 4 56 10 74 C14 82 22 80 22 74 C16 62 20 50 30 48 Z" fill="${HAIR}"/>
    </g>
    <g class="tb-leg-l">
      <rect x="48" y="122" width="9" height="24" rx="4" fill="${SKIN}"/>
      <rect x="48" y="135" width="9" height="10" rx="2" fill="#fff"/>
      <ellipse cx="52" cy="148" rx="7.5" ry="4" fill="${SHOES}"/>
    </g>
    <g class="tb-leg-r">
      <rect x="63" y="122" width="9" height="24" rx="4" fill="${SKIN}"/>
      <rect x="63" y="135" width="9" height="10" rx="2" fill="#fff"/>
      <ellipse cx="68" cy="148" rx="7.5" ry="4" fill="${SHOES}"/>
    </g>
    <g class="tb-arm-l"><g transform="rotate(14 41 94)">
      <rect x="36" y="93" width="9" height="25" rx="4.5" fill="${SKIN}"/>
      <rect x="35" y="91" width="11" height="10" rx="4.5" fill="${DRESS}"/>
      <circle cx="40.5" cy="119" r="5" fill="${SKIN}"/>
    </g></g>
    <g class="tb-arm-r"><g transform="rotate(-14 79 94)">
      <rect x="75" y="93" width="9" height="25" rx="4.5" fill="${SKIN}"/>
      <rect x="74" y="91" width="11" height="10" rx="4.5" fill="${DRESS}"/>
      <circle cx="79.5" cy="119" r="5" fill="${SKIN}"/>
    </g></g>
    <path d="M45 89 Q60 85 75 89 L84 128 Q60 135 36 128 Z" fill="${DRESS}"/>
    <path d="M38 121 Q60 128 82 121 L83 126 Q60 133 37 126 Z" fill="${DRESS_LIGHT}"/>
    <path d="M52 89 L60 97 L68 89 Q60 86 52 89 Z" fill="#fff"/>
    <path d="M60 106 C57 101.5 51.5 103.5 53.5 108 L60 114 L66.5 108 C68.5 103.5 63 101.5 60 106 Z" fill="#fff" opacity=".9"/>
    <g class="tb-head">
      <path d="M24 56 C22 26 42 14 60 14 C78 14 98 26 96 56 Z" fill="${HAIR}"/>
      <ellipse cx="60" cy="57" rx="32" ry="30" fill="${SKIN}"/>
      <path d="M28 52 C29 27 45 18 60 18 C76 18 92 28 92 52 C85 42 77 37 70 35 C66 43 56 45 50 41 C45 47 36 51 28 52 Z" fill="${HAIR}"/>
      ${star(28, 41, 6.5)}${star(92, 41, 6.5)}
      ${faceParts({ ink: INK, mouth: MOUTH, brow: HAIR })}
      ${FRECKLES}
      ${partyHat(68, 16, 14)}
    </g>`);
