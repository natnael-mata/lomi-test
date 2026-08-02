import { describe, expect, it } from 'vitest';

import { generateDisplayName } from './display-name';

describe('generateDisplayName (T-086)', () => {
  const sample = Array.from({ length: 500 }, () => generateDisplayName());

  it('is two capitalised words and four digits', () => {
    for (const name of sample) expect(name).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{4}$/);
  });

  it('always carries a four-digit suffix, so the pair alone never has to be unique', () => {
    for (const name of sample) {
      const digits = name.match(/\d+$/)?.[0];
      expect(digits).toHaveLength(4);
      expect(Number(digits)).toBeGreaterThanOrEqual(1000);
    }
  });

  it('varies', () => {
    // Not a distribution test — just proof it is not returning a constant.
    expect(new Set(sample).size).toBeGreaterThan(400);
  });

  it('draws on both halves of the word list', () => {
    const adjectives = new Set(sample.map((n) => n.match(/^[A-Z][a-z]+/)![0]));
    expect(adjectives.size).toBeGreaterThan(5);
  });

  // The rule this exists for: nothing about the handle can come from the person.
  it('contains no name a student supplied', () => {
    for (const name of sample) {
      expect(name.toLowerCase()).not.toContain('beki');
      expect(name.toLowerCase()).not.toContain('test');
    }
  });

  it('is safe to read out loud — letters and digits only', () => {
    for (const name of sample) expect(name).toMatch(/^[A-Za-z0-9]+$/);
  });
});
