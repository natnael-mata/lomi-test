import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { rankMissedTopics } from './admin-users.service';

const row = (
  topicName: string,
  weightPct: number,
  asked: number,
  missed: number,
): Parameters<typeof rankMissedTopics>[0][number] => ({
  topicId: `id-${topicName}`,
  topicName,
  asked,
  missed,
  weightPct,
});

describe('most-missed topics (T-162)', () => {
  it('reports the miss rate and what it costs', () => {
    const [only] = rankMissedTopics([row('Tax', 40, 10, 3)]);
    expect(only).toMatchObject({ asked: 10, missed: 3, missRatePct: 30, weightedGapPct: 12 });
  });

  /**
   * T-162's stated test, and the reason the ranking is weighted at all.
   *
   * With equal weights, Databases is missed more often and comes first. Give
   * Algorithms the larger share of past papers and the order flips — because the
   * question an operator is asking is where the *marks* are going, not which
   * topic has the most questions in the bank.
   */
  it('reorders when a topic’s derived weight changes', () => {
    const equal = rankMissedTopics([row('Algorithms', 25, 100, 30), row('Databases', 25, 100, 50)]);
    expect(equal.map((t) => t.topicName)).toEqual(['Databases', 'Algorithms']);

    const reweighted = rankMissedTopics([
      row('Algorithms', 60, 100, 30),
      row('Databases', 25, 100, 50),
    ]);
    expect(reweighted.map((t) => t.topicName)).toEqual(['Algorithms', 'Databases']);
  });

  // Raw misses would say the opposite here, which is the whole point.
  it('is not the same as ranking by raw misses', () => {
    const ranked = rankMissedTopics([row('Heavy', 80, 100, 20), row('Light', 5, 100, 90)]);
    expect(ranked[0]!.topicName).toBe('Heavy');
    expect(ranked[0]!.missed).toBeLessThan(ranked[1]!.missed);
  });

  // A topic nobody has answered is not "0% missed" — there is no rate to report,
  // and showing one would put an untouched topic at the bottom of a list that
  // implies it has been measured.
  it('leaves out topics nobody has attempted', () => {
    expect(rankMissedTopics([row('Untouched', 50, 0, 0)])).toEqual([]);
  });

  // An unweighted topic contributes nothing rather than being guessed at — the
  // same rule as T-130.
  it('ranks an unweighted topic last rather than inventing a weight', () => {
    const ranked = rankMissedTopics([row('Unweighted', 0, 10, 10), row('Weighted', 30, 10, 3)]);
    expect(ranked[0]!.topicName).toBe('Weighted');
  });

  it('breaks ties by name, so the same data always reads the same way', () => {
    const a = rankMissedTopics([row('Zulu', 20, 10, 5), row('Alpha', 20, 10, 5)]);
    expect(a.map((t) => t.topicName)).toEqual(['Alpha', 'Zulu']);
  });

  it('handles a perfect topic without dividing by zero', () => {
    expect(rankMissedTopics([row('Perfect', 50, 10, 0)])[0]!.weightedGapPct).toBe(0);
  });
});

/**
 * `isRetaker` is captured and drives nothing (T-166, D8).
 *
 * The task's own test is a grep, and it is the right shape: this is a rule about
 * what the code may *not* do, and the way it gets broken is somebody adding one
 * innocuous `if` when a retaker-specific feature is asked for. A behavioural
 * test cannot catch that; a walk over the source can.
 */
describe('the retaker flag drives nothing (T-166)', () => {
  const ROOTS = [resolve(__dirname, '..'), resolve(__dirname, '../../../web')];

  function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (['node_modules', '.next', '.next-build', 'dist', 'generated'].includes(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) sources(full, out);
      else if (/\.tsx?$/.test(name)) out.push(full);
    }
    return out;
  }

  const HITS = ROOTS.flatMap((root) => sources(root))
    .map((file) => ({ file, lines: readFileSync(file, 'utf8').split('\n') }))
    .flatMap(({ file, lines }) =>
      lines
        .map((text, i) => ({ file, line: i + 1, text }))
        .filter((l) => l.text.includes('isRetaker')),
    );

  it('finds the flag somewhere, so this test is checking something', () => {
    expect(HITS.length).toBeGreaterThan(0);
  });

  /**
   * The rule: it may be written, read into a payload, or displayed. It may never
   * be the condition of anything.
   */
  it('is never branched on', () => {
    const branching = HITS.filter((hit) => {
      const t = hit.text.trim();
      // Comments and this test file explain the rule; they do not enact it.
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('///')) return false;
      if (hit.file.endsWith('missed-topics.test.ts')) return false;
      /*
       * Branching on the VALUE, not on whether it was supplied.
       *
       * `isRetaker?: boolean` is an optional-property declaration and
       * `typeof x === 'boolean'` is a presence guard at the write path — the
       * first version of this pattern flagged both, which is how a lint gets
       * switched off rather than obeyed. The `?` must be a ternary, so it is
       * excluded when a `:` follows it.
       */
      return /\b(if|switch|while)\s*\(.*isRetaker|isRetaker\s*\?(?!:)|isRetaker\s*(&&|\|\|)|isRetaker\s*===\s*(true|false)/.test(
        t,
      );
    });

    expect(
      branching.map((h) => `${h.file}:${h.line} ${h.text.trim()}`),
      'D8: isRetaker is reserved for segmentation and must drive no product behaviour',
    ).toEqual([]);
  });

  /**
   * The presence guards at the write path are about whether the caller
   * *supplied* a value, never about what it is — the distinction that keeps
   * null meaning "nobody asked" rather than "no".
   */
  it('is captured at the one onboarding question the product asks', () => {
    const written = HITS.filter((h) => h.file.includes('auth.service.ts'));
    expect(written.length).toBeGreaterThan(0);
  });
});
