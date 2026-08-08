/**
 * The product is Lomi-Test (ሎሚ), everywhere (T-201, D1).
 *
 * A rename is only finished when the old name cannot come back, and the two
 * places it survives here are the rename *documenting itself* — PRODUCT.md
 * recording that Fetena is retired, and T-201's own line in TASK.md. Those are
 * the record of the decision; deleting them to satisfy a grep would erase why
 * the rule exists, which is the whole failure mode this repo keeps writing
 * comments to avoid.
 *
 * So the sweep allows exactly those two files and fails on anything else.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Where the retirement itself is recorded. Nowhere else may say it.
 *
 * This file is on the list because it names the forbidden word in order to
 * forbid it — the same exemption `copy.test.ts` gives itself, and the fifth time
 * in this repo that a rule has had to be told apart from its own statement.
 */
const ALLOWED = new Set(['PRODUCT.md', 'TASK.md', 'apps/web/components/branding.test.ts']);

/**
 * `.claude` holds worktrees for spawned side-tasks, each a whole checkout of
 * this repo. Without it every one of them doubles the sweep and fails it on
 * somebody else's branch — the same reason eslint ignores them.
 */
const SKIP = new Set([
  'node_modules',
  '.git',
  '.claude',
  '.next',
  '.next-build',
  '.pgdata',
  'dist',
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const FILES = walk(REPO).filter((f) => /\.(ts|tsx|css|json|md|mjs|prisma|sql|html)$/.test(f));

describe('branding (T-201)', () => {
  it('has files to sweep', () => {
    // Guards the walker: a sweep over zero files passes forever.
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('says Fetena nowhere except where the rename is recorded', () => {
    const offenders = FILES.filter((file) => {
      const rel = relative(REPO, file);
      if (ALLOWED.has(rel)) return false;
      return /fetena/i.test(readFileSync(file, 'utf8'));
    }).map((f) => relative(REPO, f));

    expect(offenders, `these still say Fetena: ${offenders.join(', ')}`).toEqual([]);
  });

  /**
   * The allow-list must stay honest: if the retirement note is ever deleted from
   * those files, the exemption should go with it rather than sitting there
   * quietly permitting the old name to come back.
   */
  it('still needs every exemption it grants', () => {
    for (const rel of ALLOWED) {
      expect(
        /fetena/i.test(readFileSync(join(REPO, rel), 'utf8')),
        `${rel} no longer mentions the rename — drop it from ALLOWED`,
      ).toBe(true);
    }
  });

  // The Amharic name is how students say it out loud, so it belongs where
  // somebody meets the product: a shared link, a tab on the home screen.
  it('carries the Amharic name in the default title', () => {
    const layout = readFileSync(join(REPO, 'apps/web/app/layout.tsx'), 'utf8');
    expect(layout).toContain('ሎሚ');
    expect(layout).toContain("applicationName: 'Lomi-Test'");
  });

  it('names the product in the README and the root package', () => {
    expect(readFileSync(join(REPO, 'README.md'), 'utf8')).toContain('Lomi-Test (ሎሚ)');
    expect(readFileSync(join(REPO, 'package.json'), 'utf8')).toContain('"name": "lomi-test"');
  });
});
