/**
 * Hana: an original chibi girl with a ponytail. Drawn for TomoBreak.
 *
 * Every default character uses the same `tb-*` part classes so the shared
 * animations in characters.css work for all of them:
 *   tb-figure (whole body), tb-head, tb-arm-l/r, tb-leg-l/r, tb-hair-swing,
 *   eyes: tb-eyes-open | tb-eyes-happy | tb-eyes-closed | tb-eyes-sad | tb-eyes-wide
 *   mouths: tb-mouth-smile | tb-mouth-open | tb-mouth-sad | tb-mouth-o
 *   extras: tb-tear, tb-zzz, tb-sparkles
 * Static rotations are applied on inner <g>s because CSS animations
 * replace the `transform` of the element they run on.
 */
const HAIR = '#5b3a29';
const SKIN = '#ffe0c7';
const DRESS = '#7ec8e3';
const INK = '#2d2240';
const MOUTH = '#c2405a';

export const hanaSvg = `
<svg class="tb-svg" viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <ellipse class="tb-shadow" cx="60" cy="154" rx="26" ry="4" fill="#000" opacity=".15"/>
  <g class="tb-figure">
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
      <ellipse cx="40" cy="67" rx="5" ry="3" fill="#ff9bb3" opacity=".6"/>
      <ellipse cx="80" cy="67" rx="5" ry="3" fill="#ff9bb3" opacity=".6"/>

      <g class="tb-eyes-open">
        <ellipse cx="47" cy="59" rx="4.5" ry="6" fill="${INK}"/><circle cx="48.6" cy="56.4" r="1.7" fill="#fff"/>
        <ellipse cx="73" cy="59" rx="4.5" ry="6" fill="${INK}"/><circle cx="74.6" cy="56.4" r="1.7" fill="#fff"/>
      </g>
      <g class="tb-eyes-happy" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round">
        <path d="M42 60 Q47 53 52 60"/><path d="M68 60 Q73 53 78 60"/>
      </g>
      <g class="tb-eyes-closed" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round">
        <path d="M42 59 Q47 63 52 59"/><path d="M68 59 Q73 63 78 59"/>
      </g>
      <g class="tb-eyes-sad">
        <ellipse cx="47" cy="61" rx="4" ry="5" fill="${INK}"/><circle cx="48.3" cy="59" r="1.4" fill="#fff"/>
        <ellipse cx="73" cy="61" rx="4" ry="5" fill="${INK}"/><circle cx="74.3" cy="59" r="1.4" fill="#fff"/>
        <path d="M41 52 L51 49 M69 49 L79 52" stroke="${HAIR}" stroke-width="2" stroke-linecap="round"/>
      </g>
      <g class="tb-eyes-wide">
        <circle cx="47" cy="59" r="6" fill="#fff" stroke="${INK}" stroke-width="1.5"/><circle cx="47" cy="59" r="3" fill="${INK}"/>
        <circle cx="73" cy="59" r="6" fill="#fff" stroke="${INK}" stroke-width="1.5"/><circle cx="73" cy="59" r="3" fill="${INK}"/>
      </g>

      <path class="tb-mouth-smile" d="M54 72 Q60 77 66 72" fill="none" stroke="${MOUTH}" stroke-width="2.2" stroke-linecap="round"/>
      <path class="tb-mouth-open" d="M53 71 Q60 81 67 71 Z" fill="${MOUTH}"/>
      <path class="tb-mouth-sad" d="M54 76 Q60 71 66 76" fill="none" stroke="${MOUTH}" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse class="tb-mouth-o" cx="60" cy="74" rx="3.5" ry="4.5" fill="${MOUTH}"/>

      <path class="tb-tear" d="M77 66 q3 5 0 7 q-3 -2 0 -7 Z" fill="#7fd0ff"/>
    </g>
    <g class="tb-zzz" fill="#8a7fd0" font-family="system-ui, sans-serif" font-weight="700">
      <text x="14" y="26" font-size="12">z</text><text x="6" y="16" font-size="9">z</text>
    </g>
    <g class="tb-sparkles" fill="#ffc94d">
      <path d="M14 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z"/>
      <path d="M104 96 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"/>
    </g>
  </g>
</svg>`;
