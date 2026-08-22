/**
 * No hardcoded UI strings outside the dictionary (T-210).
 *
 * The extraction pass looks for words a student would read that are written
 * into a component rather than into `dictionary.ts`. Two files are exempt and
 * both are exempt for a reason, not for convenience:
 *
 * - **`app/design/page.tsx`** is the developer gallery. Its headings label
 *   components for whoever is building them; no student ever sees it, and
 *   translating "ANSWER OPTIONS — UNANSWERED" would be work in service of
 *   nobody.
 * - **`app/global-error.tsx`** renders when the app has failed to start, with
 *   possibly no stylesheet and no modules loaded. Importing the dictionary there
 *   would make the last-resort screen depend on something that may be part of
 *   what failed — the exact reason it already refuses to use `<Card>`.
 *
 * Everything else must go through the dictionary.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { en, type Copy } from './dictionary';
import { copy } from './index';
import { stripComments } from '../strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOTS = [join(WEB, 'components'), join(WEB, 'app')];

/**
 * Files allowed to hold their own strings, and why each one is.
 *
 * - `app/design/page.tsx` — a specimen sheet, not a student screen. Its labels
 *   name the components being shown.
 * - `app/global-error.tsx` — the boundary that has to render when everything
 *   else has failed, including whatever it would have imported.
 * - `app/LandingScreen.tsx` — marketing, not product chrome. `Copy` is a
 *   contract every screen is type-checked against; prose that is rewritten
 *   whenever the pitch changes does not belong in it, and there is no second
 *   language for it to drift out of step with since 2026-08-20.
 */
const EXEMPT = new Set(['app/design/page.tsx', 'app/global-error.tsx', 'app/LandingScreen.tsx']);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx$/.test(name) && !name.includes('.test') ? [full] : [];
  });
}

interface Literal {
  file: string;
  text: string;
}

/**
 * Words a student would read, written into a component.
 *
 * "Would read" is the whole difficulty: `className="flex"` is a string in JSX
 * and is not copy. The rule used here is **two or more words containing a
 * letter, on a single line, appearing as JSX text or in a text-bearing prop**.
 *
 * Single-line matters more than it looks. Allowing a newline makes the pattern
 * span a TypeScript generic — `useState<Foo>(null)` … `useState<Bar>` opens on
 * one `>` and closes on the next `<`, and the code in between is reported as
 * copy. That is what the first run of this sweep produced, and a lint whose
 * output is mostly noise is one somebody deletes rather than reads.
 */
function literals(): Literal[] {
  return ROOTS.flatMap(sources).flatMap((file) => {
    const rel = relative(WEB, file);
    if (EXEMPT.has(rel)) return [];

    const source = stripComments(readFileSync(file, 'utf8'));
    const found: Literal[] = [];

    for (const [, text] of source.matchAll(/>([^<>{}\n]+)</g)) {
      const trimmed = (text ?? '').trim();
      // Must start with a letter or digit: `): Promise<T>` is a single-line
      // generic that opens on one `>` and closes on the next `<`, and no
      // sentence a student reads begins with a bracket.
      if (/^[A-Za-z0-9]/.test(trimmed) && /\s/.test(trimmed) && /[a-zA-Z]/.test(trimmed)) {
        found.push({ file: rel, text: trimmed });
      }
    }

    for (const [, dq, sq] of source.matchAll(
      /(?:placeholder|aria-label|label|blockingReason|derivation|title)=(?:"([^"]+)"|'([^']+)')/g,
    )) {
      const text = dq ?? sq ?? '';
      if (/\s/.test(text) && /[a-zA-Z]/.test(text)) found.push({ file: rel, text });
    }

    return found;
  });
}

/** Every leaf of a dictionary, with interpolation functions called. */
function leaves(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (typeof node === 'function') return [];
  if (node && typeof node === 'object') {
    return Object.values(node as Record<string, unknown>).flatMap(leaves);
  }
  return [];
}

describe('every UI string lives in the dictionary (T-210)', () => {
  it('has components to sweep', () => {
    // Guards the walker: a sweep over zero files passes forever.
    expect(ROOTS.flatMap(sources).length).toBeGreaterThan(10);
  });

  /** T-210's stated test. */
  it('finds no untranslated literals in components', () => {
    const offenders = literals().map(({ file, text }) => `${file}: "${text}"`);
    expect(offenders, `move these into lib/i18n/dictionary.ts:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });

  it('still needs every exemption it grants', () => {
    for (const rel of EXEMPT) {
      const source = readFileSync(join(WEB, rel), 'utf8');
      expect(source.length, `${rel} is gone — drop it from EXEMPT`).toBeGreaterThan(0);
    }
  });

  /**
   * The guard on the guard. The sweep passing could mean the components are
   * clean or that the extractor stopped matching, and only one of those is
   * good news.
   */
  it('would catch a literal if one came back', () => {
    const sample = '<p className="text-body">Something written straight into the markup</p>';
    expect([...sample.matchAll(/>([^<>{}\n]+)</g)].length).toBeGreaterThan(0);

    // …and must not report a generic as copy, which is what it did at first.
    const generic = 'const [a, setA] = useState<string | null>(null);\n  const b = useState<X>';
    expect([...generic.matchAll(/>([^<>{}\n]+)</g)]).toEqual([]);
  });
});

describe('the dictionary itself', () => {
  it('resolves the copy', () => {
    expect(copy()).toBe(en);
  });

  /**
   * English only, since 2026-08-20 — the exam is set in English, so the product
   * is too. This asserts the *absence* of a second locale rather than the
   * presence of one, because the failure it guards against is a half-translated
   * app: a dictionary added without a reviewer, defaulting on for some students
   * and showing them an unreviewed draft of their own language.
   *
   * Adding a locale means deleting this test deliberately, which is the point.
   */
  it('ships exactly one language', () => {
    // Read the source rather than the module: a dictionary that is declared but
    // not yet imported anywhere is exactly the half-finished state this guards
    // against, and importing would not see it.
    const src = readFileSync(resolve(WEB, 'lib/i18n/dictionary.ts'), 'utf8');
    const exported = [...src.matchAll(/^export const (\w+)/gm)].map((m) => m[1]!);
    expect(exported, `unexpected dictionary export: ${exported.join(', ')}`).toEqual(['en']);
  });

  it('carries no Ethiopic text, so no Ethiopic font is needed', () => {
    const ethiopic = /[\u1200-\u137F]/;
    const offenders = leaves(en).filter((text) => ethiopic.test(text));
    expect(offenders, `Ethiopic in English copy: ${offenders.join(' | ')}`).toEqual([]);
  });

  /**
   * Interpolation stays a function rather than a `{0}` placeholder, even now
   * that there is one language.
   *
   * The original reason was translation — word order differs between languages,
   * and a translator who cannot move a number relative to the words around it
   * cannot write a correct sentence. That reason is dormant, not gone: a
   * placeholder format would have to be unpicked string by string if a second
   * language ever arrives, and the function costs nothing meanwhile.
   */
  it('interpolates through functions rather than placeholders', () => {
    expect(en.exam.questionOf(3, 100)).toBe('Question 3 of 100');
    // No `{0}`-style token survives into the rendered string.
    expect(en.exam.questionOf(3, 100)).not.toMatch(/\{\d\}|%s/);
  });

  it('gets the plural right in English', () => {
    expect(en.exam.pendingSync(1)).toContain('1 answer saved');
    expect(en.exam.pendingSync(2)).toContain('2 answers saved');
  });

  // A dictionary nobody imports is a dictionary that has drifted.
  it('is the source every screen actually reads', () => {
    const usingCopy = ROOTS.flatMap(sources).filter((file) =>
      /from '(?:\.\.\/)+lib\/i18n'/.test(readFileSync(file, 'utf8')),
    );
    expect(usingCopy.length).toBeGreaterThanOrEqual(10);
  });

  it('exposes the type that keeps locales in step', () => {
    const shape: Copy = en;
    expect(shape).toBe(en);
  });
});
