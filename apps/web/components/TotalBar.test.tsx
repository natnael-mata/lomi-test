import { describe, expect, it, vi } from 'vitest';

import { TotalBar } from './TotalBar';

/**
 * `TotalBar` is called as a plain function rather than rendered.
 *
 * The guard runs before the JSX is returned, so a direct call exercises exactly
 * the behaviour under test — and it needs no DOM, no jsdom and no renderer. What
 * a React renderer would add here is the ability to inspect the markup, which is
 * not what this task asserts.
 */
const render = (rows: { label: string; value: number }[], total: number) =>
  TotalBar({ rows, total });

describe('TotalBar (T-096)', () => {
  const good = [
    { label: 'VAT', value: 40 },
    { label: 'Income tax', value: 35 },
    { label: 'Excise', value: 25 },
  ];

  it('renders when the rows sum to the total', () => {
    expect(() => render(good, 100)).not.toThrow();
  });

  // The task's own test. A total bar is a claim that these rows add up; one that
  // cannot be checked is the decoration DESIGN.md forbids.
  it('throws in development when they do not', () => {
    expect(() => render([{ label: 'VAT', value: 40 }], 100)).toThrow(/sum to 40, not 100/);
  });

  it('names the gap and the alternative in the error', () => {
    expect(() => render(good, 90)).toThrow(/10 over/);
    expect(() => render(good, 90)).toThrow(/StatedFigure/);
  });

  it('does not throw over floating point', () => {
    expect(() =>
      render(
        [
          { label: 'a', value: 33.33 },
          { label: 'b', value: 33.33 },
          { label: 'c', value: 33.34 },
        ],
        100,
      ),
    ).not.toThrow();
  });

  // A wrong total is bad; a blank results page in front of a student is worse,
  // and the throw has already had development and CI to be seen in.
  it('renders anyway in production rather than white-screening a student', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(() => render([{ label: 'VAT', value: 40 }], 100)).not.toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
