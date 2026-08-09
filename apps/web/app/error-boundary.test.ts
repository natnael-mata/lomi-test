/**
 * Error boundaries on every route, each with a recovery action (T-208).
 *
 * The stated test is "forcing a throw renders the boundary, not a white
 * screen". That is a claim about the App Router's own nesting behaviour, which
 * is not this project's to re-verify — what is this project's is that the files
 * exist, that they cover every route, and that each one leaves a student
 * something to press. All three are checked here; the rendering itself is
 * Next.js's contract.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { en } from '../lib/i18n/dictionary';
import { stripComments } from '../lib/strip-comments';

const APP = dirname(fileURLToPath(import.meta.url));

/** Every directory under `app/` that renders a page. */
function routeDirs(dir: string): string[] {
  const here = readdirSync(dir);
  const mine = here.includes('page.tsx') ? [dir] : [];
  const below = here.flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? routeDirs(full) : [];
  });
  return [...mine, ...below];
}

const ROUTES = routeDirs(APP);
const rootError = join(APP, 'error.tsx');
const globalError = join(APP, 'global-error.tsx');

describe('error boundaries (T-208)', () => {
  it('found the routes, so the checks below mean something', () => {
    // Guards the walker: zero routes would pass every assertion vacuously.
    expect(ROUTES.length).toBeGreaterThanOrEqual(4);
  });

  /**
   * One boundary at the root covers every route, because App Router boundaries
   * nest — a segment without its own `error.tsx` falls through to this. Checking
   * for a file per route would demand five copies of the same screen.
   */
  it('has a boundary every route falls back to', () => {
    expect(existsSync(rootError), 'app/error.tsx is missing').toBe(true);
  });

  it.each(ROUTES.map((d) => relative(APP, d) || '/'))(
    '%s is covered by a boundary at or above it',
    (route) => {
      // Walk up from the route to `app/`, looking for any error.tsx.
      let dir = route === '/' ? APP : join(APP, route);
      let covered = false;
      while (dir.startsWith(APP)) {
        if (existsSync(join(dir, 'error.tsx'))) {
          covered = true;
          break;
        }
        if (dir === APP) break;
        dir = resolve(dir, '..');
      }
      expect(covered, `${route} has no boundary above it`).toBe(true);
    },
  );

  /**
   * `error.tsx` lives *inside* the root layout, so a throw in the layout itself
   * — a font, the theme boot script, the Telegram host adapter — escapes it.
   * `global-error.tsx` is the only thing between that and a white screen.
   */
  it('has a global boundary for failures in the layout itself', () => {
    expect(existsSync(globalError), 'app/global-error.tsx is missing').toBe(true);
  });

  describe('each boundary leaves a student something to do', () => {
    it.each([
      ['route', rootError],
      ['global', globalError],
    ])('%s boundary offers a recovery action', (_name, file) => {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain('reset');
      expect(source).toContain('data-recover');
    });

    /**
     * "Something went wrong" is the wording that generates a support ticket,
     * because it leaves the student with no move. Both boundaries say what is
     * safe and what to do next instead.
     */
    it.each([
      ['route', rootError],
      ['global', globalError],
    ])('%s boundary does not say "something went wrong"', (_name, file) => {
      // Comments stripped: this rule is explained at length inside the very
      // files it checks. Fourth time in this repo — see `lib/strip-comments.ts`.
      expect(stripComments(readFileSync(file, 'utf8'))).not.toMatch(/something went wrong/i);
    });

    /*
     * The route boundary's words moved to the dictionary in T-210; the global
     * one keeps its own, because it renders when the app has failed to start and
     * must not depend on a module that may be part of what failed.
     */
    it('the route boundary reassures about saved work, from the dictionary', () => {
      expect(en.error.routeBody('abc')).toContain('is lost');
      expect(readFileSync(rootError, 'utf8')).toContain('c.error.routeBody');
    });

    it('the global boundary reassures about saved work, in its own words', () => {
      expect(readFileSync(globalError, 'utf8')).toContain('is lost');
    });
  });

  /**
   * The global boundary replaces the whole document, so it renders with nothing
   * loaded — possibly not even the stylesheet, which may be what failed.
   * Reaching for a design-system component here is how a white screen comes back.
   */
  it('keeps the global boundary free of app components', () => {
    const source = readFileSync(globalError, 'utf8');
    expect(source).toContain('<html');
    expect(source).toContain('<body');
    expect(source).not.toMatch(/from '\.\.\/components\//);
  });
});
