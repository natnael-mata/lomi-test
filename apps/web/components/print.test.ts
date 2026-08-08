/**
 * No content view is printable or downloadable (T-205).
 *
 * **Stated honestly, because the alternative is believing the wrong thing:**
 * this is a speed bump, not a control. Anybody determined can screenshot,
 * retype, or read the network response. What it stops is the casual
 * high-volume path — Ctrl+P on the review screen, where a hundred explanations
 * come out of one keystroke.
 *
 * The defences that actually hold are elsewhere and are tested elsewhere:
 * answer content never reaches a student before they have attempted the
 * question (T-124, T-106), and there is no export endpoint at all — which is
 * the half of this task worth enforcing, and the half checked below.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const THEME = readFileSync(join(REPO, 'design-system/tailwind-theme.css'), 'utf8');

/** The `@media print` block, or an empty string. */
function printBlock(): string {
  const start = THEME.indexOf('@media print');
  if (start === -1) return '';
  const open = THEME.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < THEME.length; i++) {
    if (THEME[i] === '{') depth++;
    else if (THEME[i] === '}' && --depth === 0) return THEME.slice(open + 1, i);
  }
  return '';
}

/** Every API source file, for the export sweep. */
function apiSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return apiSources(full);
    return name.endsWith('.ts') && !name.includes('.test.') ? [full] : [];
  });
}

describe('question content is not printable (T-205)', () => {
  it('has a print block at all', () => {
    expect(printBlock().length, 'no @media print rules').toBeGreaterThan(0);
  });

  /**
   * The selectors that carry answer content. Named individually rather than
   * blanking the page, so a student printing a support reference still gets a
   * usable sheet.
   */
  it('hides the stem, the explanation and the review', () => {
    const block = printBlock();
    for (const selector of ['[data-stem]', '[data-answer-view]', '[data-exam-review]']) {
      expect(block, `${selector} would still print`).toContain(selector);
    }
    expect(block).toContain('display: none');
  });

  // A blank sheet reads as a bug. This one says what happened.
  it('explains itself on the printed page', () => {
    expect(printBlock()).toContain('not printable');
  });

  /**
   * The guard that matters more than the stylesheet.
   *
   * A print rule is cosmetic; an export endpoint is a copy of the bank behind
   * one request. There is no such route, and this fails the moment somebody
   * adds one — which is exactly when it would be added for a good reason and
   * shipped without anyone thinking about the bank.
   */
  it('exposes no export or download route anywhere in the API', () => {
    const offenders: string[] = [];
    for (const file of apiSources(join(REPO, 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      for (const [, route] of source.matchAll(/@(?:Get|Post)\(\s*'([^']*)'/g)) {
        if (/export|download|csv|dump|backup/i.test(route ?? '')) {
          offenders.push(`${file.replace(REPO, '')} → ${route}`);
        }
      }
    }
    expect(offenders, `these look like export routes: ${offenders.join(', ')}`).toEqual([]);
  });

  it('found routes to sweep, so an empty result means something', () => {
    // Guards the sweep: a regex that matches nothing passes forever.
    let routes = 0;
    for (const file of apiSources(join(REPO, 'apps/api/src'))) {
      routes += [...readFileSync(file, 'utf8').matchAll(/@(?:Get|Post)\(/g)].length;
    }
    expect(routes).toBeGreaterThan(15);
  });
});
