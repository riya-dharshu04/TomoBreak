/**
 * Minimal inline-SVG bar chart (no libraries). One series per chart, so the
 * chart title names it and no legend is needed. Bars have 4 px rounded tops
 * anchored to the baseline, 2 px gaps, a recessive axis, a hover tooltip
 * per bar (full-height hit target) and a screen-reader table.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

const WIDTH = 320;
const HEIGHT = 120;
const TOP = 14;
const BOTTOM = 20;
const GAP = 2;
const RADIUS = 4;

export interface Bar {
  /** Short axis label, e.g. "Mon" or "12". */
  label: string;
  /** Full label for the tooltip and table, e.g. "Mon, Oct 12". */
  longLabel: string;
  value: number;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

/** Bar with only the top corners rounded, so it sits flat on the baseline. */
function barPath(x: number, y: number, w: number, base: number): string {
  const r = Math.min(RADIUS, w / 2, base - y);
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`;
}

export function barChart(title: string, bars: readonly Bar[], unit: string): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'chart';
  const caption = document.createElement('figcaption');
  caption.className = 'chart-title';
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  caption.textContent = `${title} · ${total} total`;

  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const base = HEIGHT - BOTTOM;
  const step = WIDTH / Math.max(1, bars.length);
  const barWidth = Math.max(2, step - GAP);
  // Label every bar for a week, about every 5th for a month.
  const labelEvery = bars.length <= 7 ? 1 : 5;

  const chart = svg('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: 'chart-svg', role: 'img', 'aria-label': `${title}: ${total} ${unit} in ${bars.length} days` });
  chart.append(svg('line', { x1: 0, x2: WIDTH, y1: base + 0.5, y2: base + 0.5, class: 'chart-axis' }));
  const maxLabel = svg('text', { x: 0, y: 10, class: 'chart-label' });
  maxLabel.textContent = `max ${max}`;
  chart.append(maxLabel);

  bars.forEach((bar, i) => {
    const x = i * step + GAP / 2;
    const group = svg('g', { class: 'chart-bar' });
    const tooltip = svg('title', {});
    tooltip.textContent = `${bar.longLabel}: ${bar.value} ${unit}`;
    // Invisible full-height column: a hover target bigger than the bar.
    group.append(tooltip, svg('rect', { x: i * step, y: TOP, width: step, height: base - TOP, class: 'chart-hit' }));
    if (bar.value > 0) {
      const y = base - ((base - TOP) * bar.value) / max;
      group.append(svg('path', { d: barPath(x, y, barWidth, base), class: 'chart-fill' }));
    }
    if (i % labelEvery === 0 || i === bars.length - 1) {
      const label = svg('text', { x: x + barWidth / 2, y: HEIGHT - 5, class: 'chart-label', 'text-anchor': 'middle' });
      label.textContent = bar.label;
      group.append(label);
    }
    chart.append(group);
  });

  // The same numbers as a table for screen readers.
  const table = document.createElement('table');
  table.className = 'sr-only';
  const head = table.createTHead().insertRow();
  for (const text of ['Day', unit]) {
    const th = document.createElement('th');
    th.textContent = text;
    head.append(th);
  }
  const body = table.createTBody();
  for (const bar of bars) {
    const row = body.insertRow();
    row.insertCell().textContent = bar.longLabel;
    row.insertCell().textContent = String(bar.value);
  }

  figure.append(caption, chart, table);
  return figure;
}
