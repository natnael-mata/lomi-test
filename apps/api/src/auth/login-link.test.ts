import { describe, expect, it } from 'vitest';

import {
  LOGIN_REQUEST_TTL_SEC,
  START_PAYLOAD_MAX,
  canClaim,
  canDecide,
  deepLink,
  expiryFrom,
  isDeliverablePayload,
  nonceFromPayload,
  pairingCodeFrom,
  requestState,
  startPayload,
  type LoginRequestRow,
} from './login-link';

const NOW = new Date('2026-08-05T10:00:00.000Z');

const row = (over: Partial<LoginRequestRow> = {}): LoginRequestRow => ({
  expiresAt: new Date(NOW.getTime() + 60_000),
  approvedAt: null,
  declinedAt: null,
  claimedAt: null,
  ...over,
});

describe('the Telegram login link (T-075–T-078)', () => {
  describe('what a request currently is', () => {
    it('starts pending', () => {
      expect(requestState(row(), NOW)).toBe('pending');
    });

    it('is approved once the bot says so', () => {
      expect(requestState(row({ approvedAt: NOW }), NOW)).toBe('approved');
    });

    it('is claimed once the browser has taken its session', () => {
      expect(requestState(row({ approvedAt: NOW, claimedAt: NOW }), NOW)).toBe('claimed');
    });

    it('is declined when the student says it was not them', () => {
      expect(requestState(row({ declinedAt: NOW }), NOW)).toBe('declined');
    });

    it('expires at the deadline, not a second after it', () => {
      const expiresAt = new Date(NOW.getTime() + 1000);
      expect(requestState(row({ expiresAt }), new Date(expiresAt.getTime() - 1))).toBe('pending');
      expect(requestState(row({ expiresAt }), expiresAt)).toBe('expired');
    });

    /**
     * A settled outcome outlives the clock.
     *
     * If a declined request read as merely "expired" two minutes later, the
     * record of somebody trying to sign in as this student would disappear into
     * the same bucket as every abandoned tab. That record is the point of
     * keeping the column.
     */
    it('keeps a declined request declined after it expires', () => {
      const stale = new Date(NOW.getTime() + 10 * 60_000);
      expect(requestState(row({ declinedAt: NOW }), stale)).toBe('declined');
    });

    it('keeps a claimed request claimed after it expires', () => {
      const stale = new Date(NOW.getTime() + 10 * 60_000);
      expect(requestState(row({ approvedAt: NOW, claimedAt: NOW }), stale)).toBe('claimed');
    });
  });

  describe('what may still happen to it', () => {
    it('lets the bot decide only while pending', () => {
      expect(canDecide(row(), NOW)).toBe(true);
      expect(canDecide(row({ approvedAt: NOW }), NOW)).toBe(false);
      expect(canDecide(row({ declinedAt: NOW }), NOW)).toBe(false);
      expect(canDecide(row({ expiresAt: NOW }), NOW)).toBe(false);
    });

    it('lets the browser claim only once, and only after approval', () => {
      expect(canClaim(row(), NOW)).toBe(false);
      expect(canClaim(row({ approvedAt: NOW }), NOW)).toBe(true);
      expect(canClaim(row({ approvedAt: NOW, claimedAt: NOW }), NOW)).toBe(false);
      expect(canClaim(row({ declinedAt: NOW }), NOW)).toBe(false);
    });

    // T-078: the window is short on purpose.
    it('expires two minutes out', () => {
      expect(LOGIN_REQUEST_TTL_SEC).toBe(120);
      expect(expiryFrom(NOW).getTime() - NOW.getTime()).toBe(120_000);
    });

    it('never approves an expired request, however recently it was made', () => {
      expect(canDecide(row({ expiresAt: new Date(NOW.getTime() - 1) }), NOW)).toBe(false);
    });
  });

  describe('the deep link', () => {
    it('carries the nonce', () => {
      expect(deepLink('LomiTestBot', 'abc123')).toBe('https://t.me/LomiTestBot?start=login_abc123');
    });

    // A link built with the @ 404s, and that reads as "login is broken" rather
    // than "the config has a stray character".
    it('tolerates a bot username written with an @', () => {
      expect(deepLink('@LomiTestBot', 'x')).toBe(deepLink('LomiTestBot', 'x'));
    });

    it('reads its own payload back', () => {
      expect(nonceFromPayload(startPayload('abc123'))).toBe('abc123');
    });

    /**
     * `/start` is shared with referral codes (T-180) and whatever comes later,
     * so "not a login payload" is an ordinary answer rather than an error.
     */
    it('says nothing about payloads that are not logins', () => {
      expect(nonceFromPayload('amb_123')).toBeNull();
      expect(nonceFromPayload('')).toBeNull();
      expect(nonceFromPayload('login_')).toBeNull();
    });

    it('refuses a nonce with characters Telegram would not carry', () => {
      expect(nonceFromPayload('login_abc.def')).toBeNull();
      expect(nonceFromPayload('login_abc/def')).toBeNull();
      expect(nonceFromPayload('login_abc def')).toBeNull();
    });

    /**
     * The silent failure worth a guard.
     *
     * Telegram drops an over-long payload and delivers a bare `/start`, so the
     * bot sees a first-time visitor and the login never completes, with nothing
     * anywhere explaining why.
     */
    it('knows which payloads will survive the trip', () => {
      expect(isDeliverablePayload(startPayload('a'.repeat(32)))).toBe(true);
      expect(isDeliverablePayload('x'.repeat(START_PAYLOAD_MAX))).toBe(true);
      expect(isDeliverablePayload('x'.repeat(START_PAYLOAD_MAX + 1))).toBe(false);
      expect(isDeliverablePayload('login_has spaces')).toBe(false);
    });

    it('produces a deliverable payload for a realistic nonce', () => {
      // 32 hex characters is what the service mints.
      expect(isDeliverablePayload(startPayload('9f'.repeat(16)))).toBe(true);
    });
  });

  describe('the pairing code', () => {
    it('is three digits, always', () => {
      for (const [a, b] of [
        [0, 0],
        [0, 7],
        [255, 255],
        [3, 232],
      ]) {
        const code = pairingCodeFrom(Uint8Array.from([a!, b!]));
        expect(code).toMatch(/^\d{3}$/);
      }
    });

    it('pads a small number rather than showing two digits', () => {
      expect(pairingCodeFrom(Uint8Array.from([0, 7]))).toBe('007');
    });

    it('is stable for the same bytes', () => {
      const bytes = Uint8Array.from([12, 34]);
      expect(pairingCodeFrom(bytes)).toBe(pairingCodeFrom(bytes));
    });

    // Digits only: it is compared across two screens by somebody in a hurry, and
    // letters invite the l/1 and O/0 confusions exactly then.
    it('contains no letters', () => {
      expect(pairingCodeFrom(Uint8Array.from([200, 100]))).not.toMatch(/[a-z]/i);
    });

    it('survives being handed too few bytes', () => {
      expect(() => pairingCodeFrom(Uint8Array.from([]))).not.toThrow();
      expect(pairingCodeFrom(Uint8Array.from([]))).toBe('000');
    });
  });
});
