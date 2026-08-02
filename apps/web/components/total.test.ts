import { describe, expect, it } from 'vitest';

import { mismatchMessage, sumsTo } from './total';

describe('sumsTo (T-096)', () => {
  it('accepts rows that add up', () => {
    const check = sumsTo(
      [
        { label: 'VAT', value: 40 },
        { label: 'Income tax', value: 35 },
        { label: 'Excise', value: 25 },
      ],
      100,
    );
    expect(check.ok).toBe(true);
    expect(check.sum).toBe(100);
    expect(check.difference).toBe(0);
  });

  it('rejects rows that do not', () => {
    const check = sumsTo(
      [
        { label: 'VAT', value: 40 },
        { label: 'Income tax', value: 35 },
      ],
      100,
    );
    expect(check.ok).toBe(false);
    expect(check.sum).toBe(75);
    expect(check.difference).toBe(-25);
  });

  // The reason this compares integers: 0.1 + 0.2 !== 0.3, and a bar that
  // rejected real data over binary floating point would be switched off.
  it('accepts figures that only fail as floats', () => {
    expect(
      sumsTo(
        [
          { label: 'a', value: 0.1 },
          { label: 'b', value: 0.2 },
        ],
        0.3,
      ).ok,
    ).toBe(true);
    expect(
      sumsTo(
        [
          { label: 'a', value: 33.33 },
          { label: 'b', value: 33.33 },
          { label: 'c', value: 33.34 },
        ],
        100,
      ).ok,
    ).toBe(true);
  });

  it('still catches a real discrepancy of one hundredth', () => {
    const check = sumsTo(
      [
        { label: 'a', value: 33.33 },
        { label: 'b', value: 33.33 },
        { label: 'c', value: 33.33 },
      ],
      100,
    );
    expect(check.ok).toBe(false);
    expect(check.difference).toBeCloseTo(-0.01, 5);
  });

  it('handles an empty list against a zero total', () => {
    expect(sumsTo([], 0).ok).toBe(true);
    expect(sumsTo([], 100).ok).toBe(false);
  });

  it('handles negatives, which a balance column really can contain', () => {
    expect(
      sumsTo(
        [
          { label: 'in', value: 100 },
          { label: 'out', value: -40 },
        ],
        60,
      ).ok,
    ).toBe(true);
  });
});

describe('mismatchMessage', () => {
  it('names the gap and its direction so nobody counts by hand', () => {
    const short = mismatchMessage(sumsTo([{ label: 'a', value: 75 }], 100));
    expect(short).toContain('sum to 75, not 100');
    expect(short).toContain('25 short');

    const over = mismatchMessage(sumsTo([{ label: 'a', value: 110 }], 100));
    expect(over).toContain('10 over');
  });

  it('points at the component that should have been used instead', () => {
    expect(mismatchMessage(sumsTo([{ label: 'a', value: 1 }], 2))).toContain('StatedFigure');
  });
});
