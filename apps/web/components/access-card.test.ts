/**
 * What the sidebar's access card says (QA, 2026-10-06).
 *
 * It said "Ten free questions" to everybody who was not active, including a
 * student with none left and one whose paid access had ended.
 */
import { describe, expect, it } from 'vitest';

import { en } from '../lib/i18n/dictionary';
import { accessFrom } from './Navigation';

const base = {
  active: false,
  expiresAt: null,
  hasEverPaid: false,
  pendingClaim: null,
  freeRemaining: 10,
};

describe('the access card', () => {
  it('counts the free questions the server counts', () => {
    expect(accessFrom({ ...base, freeRemaining: 0 })).toEqual({ kind: 'free', left: 0 });
    expect(en.nav.freeLeft(0)).toBe('Free questions used');
    expect(en.nav.freeLeft(1)).toBe('1 free question left');
    expect(en.nav.freeLeft(4)).toBe('4 free questions left');
  });

  it('says access ended rather than calling a former subscriber free', () => {
    expect(accessFrom({ ...base, hasEverPaid: true, freeRemaining: 0 }).kind).toBe('ended');
  });

  it('says a transfer is being checked', () => {
    expect(accessFrom({ ...base, pendingClaim: { amountEtb: 300 } })).toEqual({
      kind: 'checking',
      amount: 300,
    });
  });

  it('keeps the date for somebody active, even with a renewal pending', () => {
    const status = {
      ...base,
      active: true,
      hasEverPaid: true,
      expiresAt: '2027-01-31T00:00:00.000Z',
      pendingClaim: { amountEtb: 300 },
    };
    expect(accessFrom(status).kind).toBe('active');
  });
});
