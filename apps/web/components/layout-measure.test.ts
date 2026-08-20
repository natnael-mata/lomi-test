/**
 * The layout matches DESIGN.md, and keeps matching it.
 *
 * **This test exists because the product did not match the document.** DESIGN.md
 * has said "student content sets to a 640px measure on desktop… admin sets to
 * 1200px" since it was written, and every page shipped at `max-w-md` (448px)
 * with admin at `max-w-2xl` (672px). Nothing caught it, because nothing was
 * checking the built product against the design its author wrote.
 *
 * The same for navigation: "exactly five labelled destinations… Desktop moves
 * the same five to a left rail" was specified and simply absent.
 *
 * So these assertions read the numbers out of DESIGN.md itself rather than
 * repeating them. If the document changes, this fails until the code follows.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MEASURES } from './AppShell';
import { DESTINATIONS, isActive } from './Navigation';

const here = dirname(fileURLToPath(import.meta.url));
const designRaw = readFileSync(resolve(here, '../../../DESIGN.md'), 'utf8');
// DESIGN.md wraps at ~95 columns, so a sentence spans lines. Match the prose,
// not the line breaks.
const design = designRaw.replace(/\s+/g, ' ');
const shell = readFileSync(resolve(here, 'AppShell.tsx'), 'utf8');
const nav = readFileSync(resolve(here, 'Navigation.tsx'), 'utf8');

describe('the measures come from DESIGN.md (§ Layout)', () => {
  /** Guards the guard: if the sentence moves, these tests prove nothing. */
  it('finds the rule it is enforcing', () => {
    expect(design).toMatch(/student content sets to a 640px measure on desktop/i);
    expect(design).toMatch(/admin\s+sets to 1200px/i);
  });

  it('sets student content to the 640px measure', () => {
    const stated = /(\d+)px measure on desktop/i.exec(design)?.[1];
    expect(stated).toBe('640');
    expect(MEASURES.student).toContain(stated!);
  });

  it('gives admin the 1200px it is allowed', () => {
    const stated = /admin\s+sets to (\d+)px/i.exec(design)?.[1];
    expect(stated).toBe('1200');
    expect(MEASURES.admin).toContain(stated!);
  });

  /**
   * The measure is decided once, in the shell. Pages choosing their own is how
   * the whole product ended up at 448px while the document said 640.
   */
  it('decides the measure in one place', () => {
    expect(shell).toContain('STUDENT_MEASURE');
    expect(shell).toContain('ADMIN_MEASURE');
  });
});

describe('navigation matches DESIGN.md (§ Navigation)', () => {
  it('finds the rule it is enforcing', () => {
    expect(design).toMatch(/exactly five labelled destinations/i);
    expect(design).toMatch(/desktop moves the same five to a left rail/i);
  });

  /** "exactly five" — not four, not six. */
  it('has exactly five destinations', () => {
    expect(DESTINATIONS).toHaveLength(5);
    expect(new Set(DESTINATIONS.map((d) => d.href)).size).toBe(5);
  });

  /**
   * "Labels are never hidden." Not at any width, not on scroll.
   *
   * Checked against the rendered class list rather than the prose — an earlier
   * version of this test matched its own explanatory comment, which is a test
   * that fails on the truth and passes on silence.
   */
  it('never hides a label', () => {
    for (const d of DESTINATIONS) expect(d.label.trim().length).toBeGreaterThan(0);
    const code = nav.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // No screen-reader-only labels, and no width at which the label is dropped.
    expect(code).not.toContain('sr-only');
    expect(code).not.toMatch(/(sm|md|lg):hidden[^"']*>\s*\{destination\.label/);
  });

  /** The same five in both layouts, from one list — they cannot drift apart. */
  it('uses one list for the bar and the rail', () => {
    expect(nav).toContain('export function BottomBar');
    expect(nav).toContain('export function SideRail');
    expect((nav.match(/DESTINATIONS\.map/g) ?? []).length).toBe(2);
  });

  /** 56px, and the bar is phone-only while the rail is `sm` and up. */
  it('is 56px, bottom bar on phones and a rail above', () => {
    expect(nav).toContain('min-h-[56px]');
    expect(nav).toContain('sm:hidden');
    expect(nav).toContain('sm:flex');
  });

  /**
   * "the active item's icon sitting in a Brand Soft pill and its label in brand
   * colour" — the pill AND a second signal. Never one alone, which is the rule
   * the whole design system rests on.
   *
   * DESIGN.md's "label in brand colour" is retired with Lomi v1: the brand is a
   * lemon at 1.23:1 on cream and cannot set text. The second signal is now the
   * label's weight and ink strength — ink at 600 against ink-2 at 400, which is
   * both a 6.72:1 → 13.27:1 contrast step and a weight step, so it survives
   * greyscale exactly as the colour was meant to.
   */
  it('marks the active item with a pill and a second signal, not one alone', () => {
    expect(nav).toContain('bg-brand-soft');
    expect(nav).toContain('text-ink font-semibold');
    // The lemon must not have crept back into a label.
    expect(nav).not.toContain('text-brand');
    // And announces it, which no amount of styling does.
    expect(nav).toContain("'aria-current'");
  });

  it('keeps a destination lit on its sub-pages', () => {
    expect(isActive('/standing', '/standing')).toBe(true);
    expect(isActive('/checkout/return', '/checkout')).toBe(true);
    expect(isActive('/community/abc', '/practice')).toBe(false);
    expect(isActive('/', '/practice')).toBe(true);
    expect(isActive('/progress', '/standing')).toBe(false);
  });
});
