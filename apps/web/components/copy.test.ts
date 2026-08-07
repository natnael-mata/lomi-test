/**
 * Copy lint (T-097a).
 *
 * Decision D5: there is no official MoE blueprint, so a topic's weight is its
 * **share of past papers** and nothing stronger. "% of exam" claims the ministry
 * published a weighting it did not, and a student planning revision around that
 * number is being misled by a claim the product invented.
 *
 * Checked over the source rather than trusted to review, because the wrong
 * phrase is the more natural English and will be reached for again.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../lib/strip-comments';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.next', 'dist', 'fonts']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx|css|md)$/.test(entry)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles(WEB_ROOT);

/**
 * Comments removed before checking.
 *
 * The first run flagged `ReadinessStatement.tsx` — for the comment explaining
 * why it must never say "% of exam". A lint that cannot tell a rule from the
 * note documenting it gets weakened rather than obeyed, which is how the rule
 * would actually die. Block comments go, and so do whole lines that are
 * comments; string literals are left alone, which is where real copy lives.
 */

describe('weight captions never overclaim', () => {
  it('finds source files to check', () => {
    // Guards the walker: a lint over zero files passes forever.
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('never says "% of exam"', () => {
    const offenders = FILES.filter((f) => {
      // This file names the forbidden phrase in order to forbid it.
      if (f.endsWith('copy.test.ts')) return false;
      return /%\s*of\s*(the\s*)?exam/i.test(stripComments(readFileSync(f, 'utf8')));
    });
    expect(offenders, `these overclaim: ${offenders.join(', ')}`).toEqual([]);
  });

  it('still sees the code after comments are stripped', () => {
    // Guards the stripping: if it ate everything, the lint above passes forever.
    const stripped = stripComments(
      readFileSync(join(WEB_ROOT, 'components/ReadinessStatement.tsx'), 'utf8'),
    );
    expect(stripped).toContain('ReadinessStatement');
    expect(stripped.length).toBeGreaterThan(400);
  });

  it('uses "share of past papers" where a weight is captioned', () => {
    const readiness = readFileSync(join(WEB_ROOT, 'components/ReadinessStatement.tsx'), 'utf8');
    expect(readiness).toContain('share of past papers');
  });
});
