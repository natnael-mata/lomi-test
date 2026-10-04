/**
 * Contrast audit over the design tokens (T-099).
 *
 * Runs against `design-system/tailwind-theme.css` itself rather than a rendered
 * page, so it covers every token without a browser and fails the moment one is
 * edited. A rendered-page check would only ever cover the pairs that happened to
 * be on screen.
 *
 * **One theme, by decision (owner, 2026-08-20).** Lomi v1 is a cream page under
 * a lemon marker and has no dark counterpart — paper is one object, and a dark
 * sheet of paper is a different one. This audited two palettes until then; the
 * pairs and the threshold are unchanged, there is simply one of them now.
 *
 * WCAG 2.1 AA: 4.5:1 for body text. The threshold is not relaxed for large text
 * anywhere here — the pairs below are all used for reading, and this product is
 * read on a cheap phone in daylight.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { contrast as ratio } from '../lib/contrast';

const THEME = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../design-system/tailwind-theme.css'),
  'utf8',
);

const AA_BODY = 4.5;

/**
 * The shared implementation, narrowed for this file.
 *
 * `lib/contrast.ts` returns `null` for anything it cannot parse, because it also
 * grades colours from a Telegram host we do not control (T-178). Here every
 * input is one of our own tokens, so an unparseable one is a broken stylesheet
 * and should fail loudly rather than being reported as a low ratio.
 */
function contrast(a: string, b: string): number {
  const value = ratio(a, b);
  if (value === null) throw new Error(`not a colour: ${a} / ${b}`);
  return value;
}

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

const palette = tokens(/@theme\s*\{/);

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
  // `brand` no longer appears as a foreground anywhere. Lomi v1's brand is a
  // lemon (#ffe95c) that measures 1.23:1 on cream, so it is a FILL only; what
  // used to be a brand-coloured label is now ink over the wash. The guard that
  // it never creeps back into text is `brand is never a foreground` below.
  ['ink', 'brand-soft', 'selected option, brand chip, active nav'],
  ['correct', 'surface', 'correct text on a card'],
  ['correct', 'correct-soft', 'correct option and chip'],
  ['wrong', 'surface', 'wrong text on a card'],
  ['wrong', 'wrong-soft', 'wrong option and chip'],
  ['pending', 'surface', 'pending text on a card'],
  ['pending', 'pending-soft', 'pending chip, over-time verdict'],
  ['reward', 'surface', 'streak and points text'],
  ['on-reward', 'reward-fill', 'reward chip — solid fill'],
  ['surface', 'ink', 'the total bar: surface text on ink'],
  // `on-brand` used to be reused on saturated fills because it happened to be
  // white. That coupling only held while the brand was dark; with a lemon brand
  // `on-brand` is ink, and ink on a solid state fill is 1.5–2.0:1. `on-state`
  // is now the explicit token for text on ANY solid state fill, and every one
  // of them is audited here rather than left to whichever is used first.
  /*
   * The primary button, which is now an ink fill (handoff, 2026-08-23).
   *
   * The lemon moved to being the marker only — pending pills, flags, the
   * free-question count — because a marker that is also the primary button
   * competes with itself on every screen. Ink is the one fill with nothing
   * else to do.
   */
  ['on-state', 'ink', 'primary button label'],
  ['on-state', 'correct', 'label on a solid correct fill'],
  ['on-state', 'wrong', 'danger button label'],
  ['on-state', 'pending', 'label on a solid pending fill'],
  ['on-state', 'reward', 'label on a solid reward fill'],
  // The lettered chip on a wrong answer row (redesign, § Practice). The bright
  // red is a fill; the white letter on it clears AA where red text on its own
  // wash does not.
  ['on-state', 'wrong-bright', 'option letter on a wrong answer'],
  // The "What was tested" eyebrow, in the link amber on the concept wash.
  ['link', 'brand-soft', 'the concept card eyebrow'],
  /*
   * The dark bands (redesign handoff, 2026-10-01).
   *
   * The hero, the exam-simulator band and the footer are `ink-deep` surfaces,
   * not a dark mode — this product still has one theme. But they are read, so
   * every ink that lands on them is audited here like any other pair, and
   * `brand` is a legitimate FOREGROUND on exactly this one ground: #facc15 is
   * 1.2:1 on cream and 11.7:1 on near-black. The "never a foreground" guard
   * below is about the light surfaces, and stays.
   */
  ['on-deep', 'ink-deep', 'headings and links on a dark band'],
  ['on-deep-2', 'ink-deep', 'prose on a dark band'],
  ['on-deep-3', 'ink-deep', 'captions and meta on a dark band'],
  ['brand', 'ink-deep', 'the emphasised phrase in the hero headline'],
];

describe('contrast (T-099)', () => {
  it('defines every token the audit references', () => {
    const missing = [...new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]))].filter((t) => !palette[t]);
    expect(missing, `undefined: ${missing.join(', ')}`).toEqual([]);
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

  /**
   * The lemon is a fill. At 1.23:1 on cream it cannot legibly set text, and the
   * temptation to reach for `text-brand` as "the accent colour" is exactly how a
   * brand-coloured label gets reintroduced. Nothing in the audit would catch it:
   * a `text-brand` with no `bg-` beside it forms no pair.
   *
   * A darkened amber was considered instead and rejected — no value clears
   * 4.5:1 while staying 45 degrees from both the forest ink (89 deg) and the
   * terracotta of `wrong` (13 deg), so an amber accent reads as an error state.
   */
  it('never uses brand as a foreground', () => {
    const offenders = rules()
      .filter(({ body }) => /\btext-brand\b/.test(body))
      .map(({ selector }) => selector);
    expect(
      offenders,
      'the lemon is 1.23:1 on cream — use text-ink over bg-brand-soft instead',
    ).toEqual([]);
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

  it('reads a real palette', () => {
    // Guards the parser: an empty palette would make every pair vacuously pass,
    // which is the failure mode that looks exactly like success.
    expect(Object.keys(palette).length).toBeGreaterThan(12);
    expect(palette.bg).toBeDefined();
    expect(palette.ink).toBeDefined();
  });
});
