import { describe, expect, it } from 'vitest';

import { MAX_INIT_DATA_AGE_SEC, verifyInitData } from './telegram-init-data';

/**
 * A fixture signed with a throwaway token, not a real one.
 *
 * The hash below is a **literal**, computed once and pasted in — not recomputed
 * by the test. That is the point: a test that signs its own fixture with the
 * same code it is checking passes even if the algorithm is wrong, because both
 * sides are wrong together. Pinning the digest means the implementation has to
 * agree with a fixed value that was derived straight from Telegram's published
 * scheme.
 */
const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const HASH = 'e05ae9fea345d61bbb2a1f6d6e4c2bedbf0e48f5345f81af62c371320f991512';
const USER_JSON =
  '{"id":111222333,"first_name":"Beki","last_name":"B","username":"beki","language_code":"am","is_premium":true}';

/** auth_date 1754006400 = 2025-08-01T00:00:00Z. */
const SIGNED_AT = new Date('2025-08-01T00:00:00.000Z');
const JUST_AFTER = new Date('2025-08-01T00:05:00.000Z');

const INIT_DATA = [
  'auth_date=1754006400',
  'chat_instance=-1234567890123456789',
  'chat_type=private',
  'query_id=AAHdF6IQAAAAAN0XohDhrOrc',
  `user=${encodeURIComponent(USER_JSON)}`,
  `hash=${HASH}`,
].join('&');

const verify = (initData: string, token = BOT_TOKEN, now = JUST_AFTER) =>
  verifyInitData(initData, token, { now });

describe('verifyInitData — the known-good fixture (T-079)', () => {
  it('validates', () => {
    const result = verify(INIT_DATA);
    expect(result.ok).toBe(true);
  });

  it('extracts the user', () => {
    const result = verify(INIT_DATA);
    if (!result.ok) throw new Error(result.reason);
    expect(result.user).toEqual({
      id: '111222333',
      firstName: 'Beki',
      lastName: 'B',
      username: 'beki',
      languageCode: 'am',
      isPremium: true,
    });
  });

  it('reads the id as a string, so a large id cannot round', () => {
    const result = verify(INIT_DATA);
    if (!result.ok) throw new Error(result.reason);
    expect(typeof result.user.id).toBe('string');
  });

  it('reports when it was signed', () => {
    const result = verify(INIT_DATA);
    if (!result.ok) throw new Error(result.reason);
    expect(result.authDate).toEqual(SIGNED_AT);
  });

  it('accepts the fields in any order — the signature is over sorted pairs', () => {
    const shuffled = [
      `hash=${HASH}`,
      `user=${encodeURIComponent(USER_JSON)}`,
      'chat_type=private',
      'auth_date=1754006400',
      'query_id=AAHdF6IQAAAAAN0XohDhrOrc',
      'chat_instance=-1234567890123456789',
    ].join('&');
    expect(verify(shuffled).ok).toBe(true);
  });
});

describe('verifyInitData — tampering', () => {
  const reasonFor = (initData: string, token = BOT_TOKEN, now = JUST_AFTER): string => {
    const result = verifyInitData(initData, token, { now });
    if (result.ok) throw new Error('expected rejection');
    return result.reason;
  };

  // The attack this exists to stop: hand-write an initData naming someone else.
  it('rejects a changed user id', () => {
    const forged = INIT_DATA.replace('111222333', '999888777');
    expect(reasonFor(forged)).toContain('Signature does not match');
  });

  it('rejects a changed username', () => {
    expect(reasonFor(INIT_DATA.replace('beki', 'admin'))).toContain('Signature does not match');
  });

  it('rejects a changed auth_date', () => {
    expect(reasonFor(INIT_DATA.replace('1754006400', '1754006401'))).toContain(
      'Signature does not match',
    );
  });

  it('rejects a flipped hash', () => {
    const flipped = INIT_DATA.replace(HASH, HASH.slice(0, -1) + (HASH.endsWith('a') ? 'b' : 'a'));
    expect(reasonFor(flipped)).toContain('Signature does not match');
  });

  it('rejects a hash of the wrong length instead of throwing', () => {
    expect(reasonFor(INIT_DATA.replace(HASH, 'abcd'))).toContain('Signature does not match');
    expect(reasonFor(INIT_DATA.replace(HASH, ''))).toContain('no hash');
  });

  it('rejects an added field, which is not covered by the original signature', () => {
    expect(reasonFor(`${INIT_DATA}&is_admin=true`)).toContain('Signature does not match');
  });

  it('rejects a removed field', () => {
    expect(reasonFor(INIT_DATA.replace('chat_type=private&', ''))).toContain(
      'Signature does not match',
    );
  });

  it('rejects data signed with a different bot token', () => {
    expect(reasonFor(INIT_DATA, '7000000000:AAF-some-other-bot-token')).toContain(
      'Signature does not match',
    );
  });

  it('refuses to validate anything when no token is configured', () => {
    expect(reasonFor(INIT_DATA, '')).toContain('No bot token');
  });

  it('rejects empty input', () => {
    expect(reasonFor('')).toContain('empty');
    expect(reasonFor('   ')).toContain('empty');
  });
});

describe('verifyInitData — freshness', () => {
  const at = (now: Date) => verifyInitData(INIT_DATA, BOT_TOKEN, { now });

  it('accepts data inside the age limit', () => {
    const edge = new Date(SIGNED_AT.getTime() + (MAX_INIT_DATA_AGE_SEC - 1) * 1000);
    expect(at(edge).ok).toBe(true);
  });

  // Without this a single captured initData is a permanent credential.
  it('rejects data past the age limit', () => {
    const stale = new Date(SIGNED_AT.getTime() + (MAX_INIT_DATA_AGE_SEC + 1) * 1000);
    const result = at(stale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('the limit is');
  });

  it('honours a shorter limit when one is given', () => {
    const result = verifyInitData(INIT_DATA, BOT_TOKEN, { now: JUST_AFTER, maxAgeSec: 60 });
    expect(result.ok).toBe(false);
  });

  it('tolerates small clock skew but not a future date', () => {
    expect(at(new Date(SIGNED_AT.getTime() - 30_000)).ok).toBe(true);
    expect(at(new Date(SIGNED_AT.getTime() - 3_600_000)).ok).toBe(false);
  });
});

describe('verifyInitData — malformed but correctly signed data', () => {
  /** Signs whatever fields are given, so these cases reach the checks past the HMAC. */
  const signedWith = (fields: Record<string, string>): string => {
    // Uses the same construction as the fixture, which is safe here: these tests
    // are about what happens AFTER a valid signature, not about the signature.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHmac } = require('node:crypto') as typeof import('node:crypto');
    const pairs = Object.entries(fields)
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
    return new URLSearchParams({ ...fields, hash }).toString();
  };

  it('rejects signed data with no auth_date', () => {
    const result = verify(signedWith({ user: USER_JSON }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('auth_date');
  });

  it('rejects a non-numeric auth_date', () => {
    const result = verify(signedWith({ auth_date: 'yesterday', user: USER_JSON }));
    expect(result.ok).toBe(false);
  });

  it('rejects signed data with no user', () => {
    const result = verify(signedWith({ auth_date: '1754006400' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('user');
  });

  it('rejects a user that is not JSON, or has no numeric id', () => {
    expect(verify(signedWith({ auth_date: '1754006400', user: 'not json' })).ok).toBe(false);
    expect(verify(signedWith({ auth_date: '1754006400', user: '{"id":"abc"}' })).ok).toBe(false);
    expect(verify(signedWith({ auth_date: '1754006400', user: '[]' })).ok).toBe(false);
  });

  it('accepts a user carrying only an id', () => {
    const result = verify(signedWith({ auth_date: '1754006400', user: '{"id":42}' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toEqual({
        id: '42',
        firstName: null,
        lastName: null,
        username: null,
        languageCode: null,
        isPremium: false,
      });
    }
  });
});
