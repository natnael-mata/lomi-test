/**
 * Contrast audit over the design tokens (T-099).
 *
 * Runs against `design-system/tailwind-theme.css` itself rather than a rendered
 * page, so it covers **both themes** without a browser and fails the moment a
 * token is edited. A rendered-page check would only ever cover whichever theme
 * happened to be on, and only the pairs that happened to be on screen.
 *
 * WCAG 2.1 AA: 4.5:1 for body text. The threshold is not relaxed for large text
 * anywhere here — the pairs below are all used for reading, and this product is
 * read on a cheap phone in daylight.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const THEME = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../design-system/tailwind-theme.css'),
  'utf8',
);

const AA_BODY = 4.5;

/** Pulls `--color-*` declarations out of one block of the stylesheet. */
function tokens(openerPattern: RegExp): Record<string, string> {
  const match = openerPattern.exec(THEME);
  if (!match) throw new Error(`block not found: ${openerPattern}`);
  const open = THEME.indexOf('{', match.index);
  let depth = 0;
  let close = -1;
  for (let i = open; i < THEME.length; i++) {
    if (THEME[i] === '{') depth++;
    else if (THEME[i] === '}' && --depth === 0) {
      close = i;
      break;
    }
  }
  const body = THEME.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    if (name && value) out[name] = value;
  }
  return out;
}

const light = tokens(/@theme\s*\{/);
// The dark tokens are declared twice (see T-098); `.dark` is the explicit
// override and `theme.test.ts` asserts the media-query copy is identical, so
// checking one covers both.
const dark = { ...light, ...tokens(/\n\.dark\s*\{/) };

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every foreground/background pair the design actually puts together.
 *
 * Enumerated by hand from DESIGN.md and the component classes, because "used
 * together" is a fact about the design, not something a stylesheet states. A
 * pair added to a component and not added here is the gap this test cannot
 * close on its own — which is why `components-use-only-audited-pairs` below
 * checks the component layer for colour utilities it does not know about.
 */
const PAIRS: [fg: string, bg: string, where: string][] = [
  ['ink', 'bg', 'body text on the ground'],
  ['ink', 'surface', 'body text on a card'],
  ['ink', 'surface-2', 'text in a well or step list'],
  ['ink-2', 'bg', 'secondary text on the ground'],
  ['ink-2', 'surface', 'captions and hints on a card'],
  ['ink-2', 'surface-2', 'chip text'],
  ['on-brand', 'brand', 'primary button label'],
  ['on-brand', 'brand-hover', 'primary button label, hovered'],
  ['brand', 'surface', 'brand text on a card'],
  ['brand', 'brand-soft', 'selected option, brand chip'],
  ['correct', 'surface', 'correct text on a card'],
  ['correct', 'correct-soft', 'correct option and chip'],
  ['wrong', 'surface', 'wrong text on a card'],
  ['wrong', 'wrong-soft', 'wrong option and chip'],
  ['pending', 'surface', 'pending text on a card'],
  ['pending', 'pending-soft', 'pending chip, over-time verdict'],
  ['reward', 'surface', 'streak and points text'],
  ['on-reward', 'reward-fill', 'reward chip — solid fill'],
  ['surface', 'ink', 'the total bar: surface text on ink'],
  // `on-brand` is reused on the danger fill. It is not really "ink for brand" —
  // it is ink for ANY saturated fill, and it flips per theme (white on red in
  // light, near-black on light-red in dark), which is exactly what a red button
  // needs. Caught by the unaudited-pair guard below rather than by review.
  ['on-brand', 'wrong', 'danger button label'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('contrast in the %s theme (T-099)', (themeName, palette) => {
  it('defines every token the audit references', () => {
    const missing = [...new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]))].filter((t) => !palette[t]);
    expect(missing, `undefined in ${themeName}: ${missing.join(', ')}`).toEqual([]);
  });

  it.each(PAIRS)('%s on %s (%s) is at least 4.5:1', (fg, bg) => {
    const ratio = contrast(palette[fg]!, palette[bg]!);
    expect(
      Number(ratio.toFixed(2)),
      `--color-${fg} ${palette[fg]} on --color-${bg} ${palette[bg]}`,
    ).toBeGreaterThanOrEqual(AA_BODY);
  });
});

/**
 * The list above is hand-written, so the real risk is not a pair that fails —
 * it is a pair nobody added. This reads the component layer of the stylesheet
 * and fails on any `bg-*` / `text-*` combination the audit has never seen.
 */
describe('components use only audited pairs', () => {
  const componentLayer = (): string => {
    const start = THEME.indexOf('@layer components');
    expect(start, '@layer components not found').toBeGreaterThan(-1);
    const open = THEME.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < THEME.length; i++) {
      if (THEME[i] === '{') depth++;
      else if (THEME[i] === '}' && --depth === 0) return THEME.slice(open + 1, i);
    }
    throw new Error('unterminated @layer components');
  };

  /** Every rule body in the layer, so `bg-` and `text-` are paired per rule. */
  const rules = (): { selector: string; body: string }[] => {
    const layer = componentLayer();
    const out: { selector: string; body: string }[] = [];
    for (const [, selector, body] of layer.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (selector && body !== undefined) out.push({ selector: selector.trim(), body });
    }
    return out;
  };

  const audited = new Set(PAIRS.map(([fg, bg]) => `${fg}|${bg}`));
  // Tokens that are not colours a pair can be built from.
  const NON_TEXT = new Set(['label', 'body', 'caption', 'stem', 'display', 'title', 'left']);

  it('finds rules to check', () => {
    expect(rules().length).toBeGreaterThan(5);
  });

  it('pairs no foreground with a background the audit has not seen', () => {
    const unaudited: string[] = [];
    for (const { selector, body } of rules()) {
      const bg = [...body.matchAll(/\bbg-([\w-]+)/g)].map((m) => m[1]!);
      const fg = [...body.matchAll(/\btext-([\w-]+)/g)]
        .map((m) => m[1]!)
        .filter((t) => !NON_TEXT.has(t));
      for (const b of bg) {
        for (const f of fg) {
          if (!audited.has(`${f}|${b}`)) unaudited.push(`${selector}: text-${f} on bg-${b}`);
        }
      }
    }
    expect(
      unaudited,
      `add these to PAIRS, or change the component:\n  ${unaudited.join('\n  ')}`,
    ).toEqual([]);
  });
});

describe('the audit itself', () => {
  it('computes known ratios correctly', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // A published reference point: #767676 on white is the classic 4.54:1.
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
  });

  it('is symmetric', () => {
    expect(contrast('#5b4be0', '#ffffff')).toBeCloseTo(contrast('#ffffff', '#5b4be0'), 10);
  });

  it('reads a real palette out of both blocks', () => {
    // Guards the parser: an empty palette would make every pair vacuously pass.
    expect(Object.keys(light).length).toBeGreaterThan(12);
    expect(Object.keys(dark).length).toBeGreaterThan(12);
    expect(light.bg).not.toBe(dark.bg);
  });
});
