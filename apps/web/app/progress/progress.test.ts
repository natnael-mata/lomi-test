/**
 * What `/progress` may say twice, and what it may not (T-269).
 *
 * This screen carries more figures than any other in the product, and an audit
 * found it repeating most of them: the mock papers listed three times, and every
 * topic's score printed once in the readiness rows and again under "What each
 * score rests on". On a screen whose whole claim is that each number can be
 * checked, a number appearing twice in two framings is read as two facts.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../lib/strip-comments';
import { en } from '../../lib/i18n/dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const screen = stripComments(readFileSync(resolve(here, 'ProgressScreen.tsx'), 'utf8'));

describe('the progress screen (T-269)', () => {
  /**
   * The evidence section carries the count, not the score again.
   *
   * It read "40% from 5 answers" while the readiness rows above already printed
   * "Depreciation 40% · 25% share of past papers". The section is not a
   * duplicate — it holds the one fact those rows cannot, which is how much each
   * score rests on — but it was saying that fact *and* repeating the score.
   */
  it('states how much a score rests on without reprinting the score', () => {
    expect(screen).toContain('c.progress.fromAnswers(t.answered)');
    expect(en.progress.fromAnswers(5)).toBe('from 5 answers');
    expect(en.progress.fromAnswers(5)).not.toContain('%');
    // One answer is singular. A caveat that reads "1 answers" undermines the
    // caution it exists to give.
    expect(en.progress.fromAnswers(1)).toBe('from 1 answer');
  });

  /**
   * The caveat itself survives, because it is the point of the section.
   *
   * A topic can read 100% off a single mock question, and one more answer can
   * move the headline twenty points.
   */
  it('flags a score resting on too little', () => {
    expect(screen).toContain('c.progress.thinEvidence');
    expect(en.progress.thinEvidence.length).toBeGreaterThan(4);
  });

  /**
   * Readiness and coverage are told apart wherever both are on screen.
   *
   * They answer different questions and can differ wildly — seven questions all
   * right reads 41% coverage and 100% readiness — and side by side with nothing
   * between them they look like a product that cannot count.
   */
  it('distinguishes the two big percentages', () => {
    expect(screen).toContain('c.progress.readinessVsCoverage');
    const line = en.progress.readinessVsCoverage.toLowerCase();
    expect(line).toContain('coverage');
    expect(line).toContain('tried');
  });
});
