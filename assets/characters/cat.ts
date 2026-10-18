/**
 * Cat: a black kitten with big green eyes, pink ears, a pink bow on one ear
 * and a curly tail. Face lines are drawn light so they show on black fur.
 * Original artwork.
 */
import { characterSvg, faceParts, partyHat, whiskers } from './parts';

const FUR = '#2b2a33';
const SHADE = '#3e3c49';
const INNER = '#ff9ec2';
const BOW = '#ff6fa8';
const IRIS = '#8fd14f';
/** Light lines (closed/happy eyes, brows) that read on black fur. */
const LIGHT_INK = '#f4f0e8';
const PUPIL = '#141218';
const MOUTH = '#ff9eb5';

export const catSvg = characterSvg(`
    <g class="tb-hair-swing" data-origin="base">
      <path d="M78 124 C100 126 112 108 108 86 C106 76 112 70 117 76 C122 88 114 122 84 130 Z" fill="${FUR}"/>
    </g>
    <g class="tb-leg-l">
      <rect x="47" y="120" width="11" height="22" rx="5" fill="${FUR}"/>
      <ellipse cx="52.5" cy="145" rx="7" ry="4.8" fill="${SHADE}"/>
    </g>
    <g class="tb-leg-r">
      <rect x="62" y="120" width="11" height="22" rx="5" fill="${FUR}"/>
      <ellipse cx="67.5" cy="145" rx="7" ry="4.8" fill="${SHADE}"/>
    </g>
    <g class="tb-arm-l"><g transform="rotate(16 42 96)">
      <rect x="37" y="94" width="10" height="20" rx="5" fill="${FUR}"/>
      <circle cx="42" cy="115" r="5" fill="${SHADE}"/>
    </g></g>
    <g class="tb-arm-r"><g transform="rotate(-16 78 96)">
      <rect x="73" y="94" width="10" height="20" rx="5" fill="${FUR}"/>
      <circle cx="78" cy="115" r="5" fill="${SHADE}"/>
    </g></g>
    <ellipse cx="60" cy="110" rx="23" ry="22" fill="${FUR}"/>
    <ellipse cx="60" cy="114" rx="14" ry="15" fill="${SHADE}"/>
    <g class="tb-head">
      <path d="M30 42 L27 10 L52 28 Z" fill="${FUR}"/><path d="M33 37 L31 17 L47 29 Z" fill="${INNER}"/>
      <path d="M90 42 L93 10 L68 28 Z" fill="${FUR}"/><path d="M87 37 L89 17 L73 29 Z" fill="${INNER}"/>
      <ellipse cx="60" cy="57" rx="33" ry="28" fill="${FUR}"/>
      <path d="M57.5 65.5 L62.5 65.5 L60 68.2 Z" fill="${INNER}"/>
      ${whiskers(70, '#cfcad6')}
      ${faceParts({ ink: LIGHT_INK, mouth: MOUTH, brow: '#b7b2c0', smile: 'cat', bigEyes: IRIS, pupil: PUPIL })}
      <g fill="${BOW}">
        <path d="M81 27 l-8.5 -6.5 v13 Z M81 27 l8.5 -6.5 v13 Z"/><circle cx="81" cy="27" r="3.2"/>
      </g>
      ${partyHat(56, 31, -8)}
    </g>`);
