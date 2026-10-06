import { describe, expect, it } from 'vitest';

import { checkDisplayName, generateDisplayName } from './display-name';

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

describe('checkDisplayName (a name a student chooses)', () => {
  const refused = (raw: unknown, legal?: string) => {
    const check = checkDisplayName(raw, legal);
    return check.ok ? [] : check.reasons;
  };

  it('accepts a plain name and tidies its spaces', () => {
    expect(checkDisplayName('  Swift   Summit ')).toEqual({ ok: true, name: 'Swift Summit' });
  });

  it('accepts names in Ethiopic script', () => {
    expect(checkDisplayName('ሰላም ተማሪ').ok).toBe(true);
  });

  it('accepts every generated name, so nobody is stuck with one they cannot save', () => {
    for (let i = 0; i < 300; i += 1) expect(checkDisplayName(generateDisplayName()).ok).toBe(true);
  });

  it('holds the length to what a board row can show', () => {
    expect(refused('Ab')).toContain('Use at least 3 characters.');
    expect(refused('A'.repeat(25))).toContain('Use at most 24 characters.');
    // Counted as characters, not code units.
    expect(checkDisplayName('ሰላምሰላምሰላምሰላምሰላምሰላም').ok).toBe(true);
  });

  it('refuses links and markup', () => {
    expect(refused('<b>Top</b>')).toContain(
      'Use letters, numbers, spaces, full stops or underscores only.',
    );
    expect(refused('me@site')).toHaveLength(1);
  });

  it('refuses a phone number however it is spaced', () => {
    expect(refused('Call 0911 234 567')).toContain(
      'Leave phone numbers and other long numbers out of it.',
    );
    expect(refused('Abebe.0911.23')).toContain(
      'Leave phone numbers and other long numbers out of it.',
    );
  });

  it('refuses names that pose as the product or its staff', () => {
    for (const name of ['Lomi Admin', 'L0mi team', 'Official Bob', 'support_desk']) {
      expect(refused(name), name).toContain(
        'Choose a name that does not look like the product or its staff.',
      );
    }
  });

  it('refuses the student\u2019s own legal name, in any order', () => {
    const reason = 'Choose a name that is not your real name. Other students see this one.';
    expect(refused('Kebede Abebe', 'Abebe Kebede')).toContain(reason);
    expect(refused('abebe kebede 7', 'Abebe Kebede')).toContain(reason);
    // One name alone is not the legal name.
    expect(refused('Abebe Rising', 'Abebe Kebede')).not.toContain(reason);
  });

  it('gives every reason at once', () => {
    expect(refused('<1>').length).toBeGreaterThan(1);
  });

  it('refuses something that is not text', () => {
    expect(refused(42)).toEqual(['Type a name.']);
  });
});
