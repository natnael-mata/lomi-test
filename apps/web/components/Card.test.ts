import { describe, expect, it } from 'vitest';

import { cardClasses } from './Card';

describe('cardClasses (T-095)', () => {
  it('applies the design-system card class', () => {
    expect(cardClasses()).toBe('card');
  });

  it('appends a caller class', () => {
    expect(cardClasses('mt-4')).toBe('card mt-4');
  });

  it('emits no stray whitespace', () => {
    expect(cardClasses('')).toBe('card');
    expect(cardClasses(undefined)).toBe('card');
  });
});
