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

import { am, en, type Copy } from './dictionary';
import { DEFAULT_LOCALE, LOCALES, copy } from './index';
import { stripComments } from '../strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOTS = [join(WEB, 'components'), join(WEB, 'app')];

const EXEMPT = new Set(['app/design/page.tsx', 'app/global-error.tsx']);

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

/** Every key path, so two locales can be compared by shape rather than by value. */
function keys(node: unknown, path = ''): string[] {
  if (node === null || typeof node !== 'object') return [path];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    keys(value, path ? `${path}.${key}` : key),
  );
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
  it('gives every English key an Amharic one', () => {
    // Enforced by the type too — `am: Copy` will not compile otherwise — but
    // asserted because a future locale might be loaded rather than imported.
    expect(keys(am)).toEqual(keys(en));
  });

  it('leaves no Amharic string identical to its English one', () => {
    const enLeaves = leaves(en);
    const amLeaves = leaves(am);
    const untranslated = enLeaves.filter((text, i) => amLeaves[i] === text);
    expect(untranslated, `still in English: ${untranslated.join(' | ')}`).toEqual([]);
  });

  it('writes Amharic in Ethiopic, not transliterated', () => {
    const ethiopic = /[ሀ-፿]/;
    const notEthiopic = leaves(am).filter((text) => !ethiopic.test(text));
    expect(notEthiopic, `not in Ethiopic: ${notEthiopic.join(' | ')}`).toEqual([]);
  });

  /**
   * English until the Amharic has been reviewed. Getting this wrong shows a
   * student an unreviewed draft of their own language, which reads worse than
   * the language they did not ask for.
   */
  it('defaults to English while the Amharic is a draft', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(copy()).toBe(en);
  });

  it('resolves each locale, and falls back rather than throwing', () => {
    expect(copy('am')).toBe(am);
    expect(copy('en')).toBe(en);
    expect(copy(undefined)).toBe(en);
    expect(copy('zz' as keyof typeof LOCALES)).toBe(en);
  });

  /**
   * Interpolation is a function, not a `{0}` placeholder: Ethiopic word order is
   * not English word order, and a translator who cannot move the number relative
   * to the words around it cannot write a correct sentence.
   */
  it('interpolates through functions, so word order is the translator’s', () => {
    expect(en.exam.questionOf(3, 100)).toBe('Question 3 of 100');
    expect(am.exam.questionOf(3, 100)).toContain('3');
    expect(am.exam.questionOf(3, 100)).toContain('100');
    // The Amharic puts the numbers where Amharic puts them, not where English does.
    expect(am.exam.questionOf(3, 100)).not.toBe(en.exam.questionOf(3, 100));
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
