/**
 * `IconName` actually names the icons.
 *
 * **It was `string`.** Both glyph maps were declared `const STROKE:
 * Record<string, ReactNode>`, and an annotation like that widens every key — so
 * `keyof typeof STROKE` was `string`, the union was `string`, and
 * `<Icon name="calendar" />` typechecked cleanly against a set with no calendar
 * in it. It rendered an empty `<svg>`: the right size, the right colour,
 * nothing inside. A missing glyph is meant to be a build error, and had not been
 * one since the file was written.
 *
 * `npm run typecheck` cannot catch this on its own — a type that is secretly
 * `string` produces no errors anywhere, which is exactly what made it survive.
 * So the guard is on the shape of the declaration, read as source.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../lib/strip-comments';

const source = stripComments(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'icons.tsx'), 'utf8'),
);

describe('the icon name union', () => {
  it('finds the file', () => {
    expect(source).toContain('export type IconName');
    expect(source.length).toBeGreaterThan(800);
  });

  /**
   * The regression, stated as the thing not to write.
   *
   * `satisfies` keeps both halves: every entry is still checked as a
   * `ReactNode`, and the literal keys survive for the union. An annotation gives
   * up the second half silently.
   */
  it('does not annotate the glyph maps into oblivion', () => {
    for (const map of ['STROKE', 'FILLED']) {
      expect(source, `${map} is annotated, which widens its keys to string`).not.toMatch(
        new RegExp(`const ${map}\\s*:\\s*Record`),
      );
      expect(source, `${map} should be checked with satisfies`).toMatch(
        new RegExp(`const ${map}\\s*=\\s*\\{`),
      );
    }
    expect((source.match(/\}\s*satisfies Record<string, ReactNode>;/g) ?? []).length).toBe(2);
  });

  /**
   * Every name used anywhere in the app is one the maps define.
   *
   * The type does this now, but it did not for the whole life of the file, so
   * the cheap runtime check stays — it also covers a name built from a variable
   * that the compiler would have to trust.
   */
  it('defines every glyph the app asks for', () => {
    const defined = new Set([...source.matchAll(/^\s{2}([a-zA-Z][\w]*):\s/gm)].map((m) => m[1]!));
    expect(defined.size).toBeGreaterThan(15);
    for (const required of ['today', 'practise', 'mock', 'progress', 'account', 'calendar']) {
      expect(defined, required).toContain(required);
    }
  });
});
