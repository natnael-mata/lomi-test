/**
 * The retire confirmation's rendered contract (T-165).
 *
 * DESIGN.md calls this the only Danger button and the only modal in the system,
 * and says its blast radius is **itemised — never summarised as "this affects
 * many students"**, because a number an operator can check is what makes them
 * stop and read. That is a claim about what the component may not do, so most of
 * it is asserted against the source.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RetireConfirmation } from './RetireConfirmation';
import { stripComments } from '../lib/strip-comments';

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'RetireConfirmation.tsx'),
  'utf8',
);
const copy = stripComments(source);

const props = {
  stableId: 'ACC-0142',
  radius: { attempts: 1284, liveSittings: 3, studentsAffected: 340, measurable: true },
  reason: 'Option B is also correct.',
  onReasonChange: () => undefined,
  onConfirm: () => undefined,
  onCancel: () => undefined,
};

describe('RetireConfirmation (T-165)', () => {
  it('renders', () => {
    expect(() => RetireConfirmation(props)).not.toThrow();
  });

  it('renders before the counts are measurable', () => {
    expect(() =>
      RetireConfirmation({
        ...props,
        radius: {
          attempts: null,
          liveSittings: null,
          studentsAffected: null,
          measurable: false,
        },
      }),
    ).not.toThrow();
  });

  // Guards the stripping, at both ends of the file.
  it('still sees the component after comments are stripped', () => {
    expect(copy).toContain('RetireConfirmation');
    expect(copy).toContain('Withdraw it');
  });

  /**
   * Three counts, listed separately, with no total. They are different kinds of
   * harm — history that stays correct, a student in a timed exam right now, and
   * a readiness figure built partly on a question about to be withdrawn — and
   * one number would let all three be skimmed past.
   */
  it('itemises all three counts', () => {
    for (const line of ['attempts', 'sittings in progress', 'readiness']) {
      expect(copy, `${line} is not itemised`).toContain(line);
    }
  });

  it('never summarises the radius', () => {
    for (const banned of ['many students', 'several', 'a number of', 'affects many']) {
      expect(copy, `"${banned}" is the summary DESIGN.md forbids`).not.toContain(banned);
    }
  });

  /**
   * Null is "not measurable", never zero. Reporting 0 would tell an operator
   * that withdrawing this disturbs nobody — a claim the code cannot make, and
   * the exact reason the counts were null until the attempt tables existed.
   */
  it('says "not known" rather than zero when a count is unmeasurable', () => {
    expect(copy).toContain('Not known');
    expect(copy).toContain('=== null');
  });

  // The one Danger button in the product.
  it('uses the danger variant, once', () => {
    expect(copy.match(/variant="danger"/g)).toHaveLength(1);
  });

  /**
   * A reason is required before the button works. An unexplained withdrawal is
   * one nobody can review later, and the audit row would carry nothing.
   */
  it('will not withdraw without a reason', () => {
    expect(copy).toContain('reason.trim().length === 0');
    expect(copy).toContain('blockingReason');
  });

  // Says what withdrawing does and does not do. "Are you sure?" is a question
  // that tells an operator nothing they did not already know.
  it('explains what happens, rather than asking if they are sure', () => {
    expect(copy).toContain('not deleted');
    expect(copy).not.toMatch(/are you sure/i);
  });
});
