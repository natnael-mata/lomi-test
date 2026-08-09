/**
 * The first-load JS budget is real and enforced (T-203).
 *
 * The measurement itself lives in `js-budget.mjs` and runs against a build, so
 * it cannot run inside the unit suite — there may be no `.next-build` at all.
 * What is checked here is everything that makes the measurement *matter*: the
 * budget is the number the task names, the script is wired to `npm run analyze`,
 * and CI runs it.
 *
 * A budget nobody runs is a comment.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '../..');
const script = readFileSync(join(WEB, 'scripts/js-budget.mjs'), 'utf8');

describe('the first-load JS budget (T-203)', () => {
  it('holds the practice route to 300 KB, which is what T-203 names', () => {
    expect(script).toMatch(/'\/practice\/page':\s*300/);
  });

  /**
   * The practice route is the one that must be tightest: it is where a student
   * spends their time and the route they open on a bad connection. Nothing else
   * may be held to a *looser* budget without that being visible here.
   */
  it('never lets another route be tighter than practice by accident', () => {
    const budgets = [...script.matchAll(/'(\/[^']*)':\s*(\d+),/g)].map(([, route, kb]) => ({
      route,
      kb: Number(kb),
    }));
    expect(budgets.length).toBeGreaterThanOrEqual(4);
    const practice = budgets.find((b) => b.route === '/practice/page');
    expect(practice?.kb).toBe(300);
  });

  it('measures gzipped bytes, not raw', () => {
    expect(script).toContain('gzipSync');
  });

  /**
   * Read from the build manifest rather than parsed out of Next's printed
   * summary: a formatting change in the build output would silently disable the
   * budget, and nothing would look wrong.
   */
  it('reads the build manifest rather than scraping console output', () => {
    expect(script).toContain('app-build-manifest.json');
  });

  // The layout's chunks load on every route, so they count toward each one —
  // that is what "first load" means to a student arriving cold.
  it('counts the shared layout chunks in every route', () => {
    expect(script).toContain("manifest.pages['/layout']");
  });

  it('exits non-zero when a route is over', () => {
    expect(script).toContain('process.exit(1)');
  });

  describe('it is actually run', () => {
    it('is wired to npm run analyze, which is what T-203 names', () => {
      const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      };
      expect(pkg.scripts.analyze).toContain('js-budget.mjs');
    });

    it('runs in CI, after the build that produces the manifest', () => {
      const ci = join(REPO, '.github/workflows/ci.yml');
      expect(existsSync(ci)).toBe(true);
      const workflow = readFileSync(ci, 'utf8');
      expect(workflow).toContain('npm run analyze');
      // Order matters: without a build there is no manifest to measure.
      expect(workflow.indexOf('npm run build')).toBeLessThan(workflow.indexOf('npm run analyze'));
    });
  });
});
