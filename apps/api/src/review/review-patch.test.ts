import { describe, expect, it } from 'vitest';

import { normalisePatch, type ReviewPatch } from './review-patch';

const ok = (input: ReviewPatch) => {
  const result = normalisePatch(input);
  if (!result.ok) throw new Error(`expected ok, got: ${result.reasons.join('; ')}`);
  return result.patch;
};

const bad = (input: ReviewPatch) => {
  const result = normalisePatch(input);
  if (result.ok) throw new Error('expected rejection');
  return result.reasons;
};

describe('normalisePatch (T-068a)', () => {
  it('accepts the answer, the concept line and the why-wrongs together', () => {
    const patch = ok({
      correctOption: 'c',
      conceptLine: 'Equal chance for every unit means simple random sampling.',
      whyWrong: { a: 'Purposive picks deliberately.', B: 'Snowball recruits by referral.' },
    });
    expect(patch.correctOption).toBe('C');
    expect(patch.whyWrong).toEqual([
      { label: 'A', value: 'Purposive picks deliberately.' },
      { label: 'B', value: 'Snowball recruits by referral.' },
    ]);
    expect(patch.conceptLine).toContain('simple random');
  });

  it('uppercases and trims an option letter', () => {
    expect(ok({ correctOption: ' d ' }).correctOption).toBe('D');
  });

  it('rejects an option letter outside A–D', () => {
    expect(bad({ correctOption: 'e' }).join(' ')).toContain('not one of A, B, C, D');
    expect(bad({ whyWrong: { z: 'nope' } }).join(' ')).toContain('option "z"');
  });

  // An empty patch that "succeeds" reads as "saved", and the reviewer walks away
  // believing they wrote something.
  it('rejects an empty patch rather than reporting a silent success', () => {
    expect(bad({}).join(' ')).toContain('the patch is empty');
  });

  it('treats an empty string as a clear, not as content', () => {
    const patch = ok({ conceptLine: '   ', whyWrong: { A: '' } });
    expect(patch.conceptLine).toBeNull();
    expect(patch.whyWrong).toEqual([{ label: 'A', value: null }]);
  });

  it('leaves omitted fields absent, so a patch never overwrites what it did not send', () => {
    const patch = ok({ conceptLine: 'One line.' });
    expect(patch).not.toHaveProperty('explanation');
    expect(patch.whyWrong).toEqual([]);
    expect(patch.correctOption).toBeUndefined();
  });

  // Storing both would leave the gate's "exactly one correct" rule satisfied
  // while the answer view explains the right answer as wrong.
  it('rejects marking an option correct and giving it a why-wrong at once', () => {
    expect(bad({ correctOption: 'B', whyWrong: { B: 'because it is wrong' } }).join(' ')).toContain(
      'marked correct and given a why-wrong',
    );
  });

  it('allows clearing the why-wrong on the option being marked correct', () => {
    const patch = ok({ correctOption: 'B', whyWrong: { B: null } });
    expect(patch.whyWrong).toEqual([{ label: 'B', value: null }]);
  });
});

describe('normalisePatch — timeLimitSec', () => {
  it('accepts a value inside the gate’s bounds', () => {
    expect(ok({ timeLimitSec: 180 }).timeLimitSec).toBe(180);
  });

  it('rejects values the gate would refuse anyway, at the point of writing', () => {
    for (const value of [0, 14, 601, 60.5, Number.NaN]) {
      expect(bad({ timeLimitSec: value }).join(' ')).toContain('between 15 and 600');
    }
  });
});

describe('normalisePatch — steps', () => {
  it('sorts the working by stepNo, whatever order it arrived in', () => {
    const patch = ok({
      steps: [
        { stepNo: 3, text: '= 150,000 → answer B' },
        { stepNo: 1, text: 'The amount is VAT-inclusive.' },
        { stepNo: 2, text: '1,150,000 × 15/115', formula: 'gross × 15/115' },
      ],
    });
    expect(patch.steps?.map((s) => s.stepNo)).toEqual([1, 2, 3]);
    expect(patch.steps?.[1]?.formula).toBe('gross × 15/115');
  });

  it('rejects duplicate step numbers, which would render in an arbitrary order', () => {
    expect(
      bad({
        steps: [
          { stepNo: 1, text: 'first' },
          { stepNo: 1, text: 'also first' },
        ],
      }).join(' '),
    ).toContain('share a stepNo');
  });

  it('rejects a step with no text and a stepNo below 1', () => {
    expect(bad({ steps: [{ stepNo: 1, text: '  ' }] }).join(' ')).toContain('not a step');
    expect(bad({ steps: [{ stepNo: 0, text: 'zero' }] }).join(' ')).toContain('1 or more');
  });

  it('accepts an empty list, which clears the working', () => {
    expect(ok({ steps: [] }).steps).toEqual([]);
  });

  it('nulls a blank formula rather than storing an empty string', () => {
    expect(ok({ steps: [{ stepNo: 1, text: 'x', formula: '' }] }).steps?.[0]?.formula).toBeNull();
  });
});
