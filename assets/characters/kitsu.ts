/**
 * Kitsu: an original little fox spirit with a big swishing tail (the
 * tb-hair-swing part) and a floating spirit flame. Part classes are
 * documented in hana.ts.
 */
import { characterSvg, faceParts } from './parts';

const FUR = '#f39c4a';
const FUR_DARK = '#d9772b';
const CREAM = '#fff4e6';
const EAR_IN = '#6b3a3a';
const PAW = '#5a3b33';
const FLAME = '#b9a6ff';
const MARK = '#e8505b';
const INK = '#2d2240';
const MOUTH = '#b8404f';

export const kitsuSvg = characterSvg(`
    <g class="tb-hair-swing" data-origin="base">
      <path d="M76 126 C100 130 118 112 116 86 C115 74 106 66 98 70 C108 84 104 106 78 114 Z" fill="${FUR}"/>
      <path d="M116 88 C115 74 106 66 98 70 C100 78 108 86 116 88 Z" fill="${CREAM}"/>
      <path class="tb-flame" d="M106 52 C100 46 103 38 108 33 C108 41 114 43 112 49 C111 53 108 54 106 52 Z" fill="${FLAME}" opacity=".85"/>
    </g>
    <g class="tb-leg-l">
      <rect x="47" y="120" width="11" height="22" rx="5" fill="${FUR_DARK}"/>
      <ellipse cx="52.5" cy="146" rx="7" ry="4.5" fill="${PAW}"/>
    </g>
    <g class="tb-leg-r">
      <rect x="62" y="120" width="11" height="22" rx="5" fill="${FUR_DARK}"/>
      <ellipse cx="67.5" cy="146" rx="7" ry="4.5" fill="${PAW}"/>
    </g>
    <g class="tb-arm-l"><g transform="rotate(16 42 96)">
      <rect x="37" y="94" width="10" height="20" rx="5" fill="${FUR}"/>
      <circle cx="42" cy="115" r="5" fill="${PAW}"/>
    </g></g>
    <g class="tb-arm-r"><g transform="rotate(-16 78 96)">
      <rect x="73" y="94" width="10" height="20" rx="5" fill="${FUR}"/>
      <circle cx="78" cy="115" r="5" fill="${PAW}"/>
    </g></g>
    <ellipse cx="60" cy="110" rx="23" ry="22" fill="${FUR}"/>
    <ellipse cx="60" cy="114" rx="14" ry="15" fill="${CREAM}"/>
    <path d="M42 90 L48 98 L54 91 L60 99 L66 91 L72 98 L78 90 Z" fill="${CREAM}"/>
    <g class="tb-head">
      <path d="M30 42 L26 6 L54 28 Z" fill="${FUR}"/><path d="M33 37 L31 15 L48 29 Z" fill="${EAR_IN}"/>
      <path d="M90 42 L94 6 L66 28 Z" fill="${FUR}"/><path d="M87 37 L89 15 L72 29 Z" fill="${EAR_IN}"/>
      <path d="M28 62 L14 70 L32 76 Z" fill="${FUR}"/><path d="M92 62 L106 70 L88 76 Z" fill="${FUR}"/>
      <ellipse cx="60" cy="57" rx="33" ry="29" fill="${FUR}"/>
      <path d="M30 64 C40 58 50 62 60 66 C70 62 80 58 90 64 C88 78 76 86 60 86 C44 86 32 78 30 64 Z" fill="${CREAM}"/>
      <path d="M53 34 Q60 26 67 34 Q60 38 53 34 Z" fill="${MARK}"/>
      <ellipse cx="60" cy="68" rx="2.6" ry="1.8" fill="${INK}"/>
      ${faceParts({ ink: INK, mouth: MOUTH, brow: FUR_DARK })}
    </g>`);
