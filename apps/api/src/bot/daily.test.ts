import { describe, expect, it } from 'vitest';

import {
  ADDIS_OFFSET_MINUTES,
  REFERRAL_PREFIX,
  addisDate,
  decideDaily,
  planDaily,
  referralFromPayload,
  type DailyCandidate,
} from './daily';

const candidate = (over: Partial<DailyCandidate> = {}): DailyCandidate => ({
  userId: 'u1',
  chatId: '42',
  botOptOut: false,
  lastDailySentOn: null,
  ...over,
});

describe('the daily question (T-181, T-182)', () => {
  describe('the day boundary', () => {
    it('is UTC+3, year-round', () => {
      expect(ADDIS_OFFSET_MINUTES).toBe(180);
    });

    /**
     * The case the offset exists for. 22:30 UTC is already tomorrow in Addis, so
     * a student awake at 1:30am local has had their day roll over.
     */
    it('rolls the date at midnight in Addis, not midnight UTC', () => {
      expect(addisDate(new Date('2026-08-08T20:59:00.000Z'))).toBe('2026-08-08');
      expect(addisDate(new Date('2026-08-08T21:00:00.000Z'))).toBe('2026-08-09');
    });

    it('formats as YYYY-MM-DD, zero-padded', () => {
      expect(addisDate(new Date('2026-01-05T06:00:00.000Z'))).toBe('2026-01-05');
      expect(addisDate(new Date('2026-12-31T09:00:00.000Z'))).toBe('2026-12-31');
    });

    it('crosses a year boundary correctly', () => {
      expect(addisDate(new Date('2026-12-31T21:00:00.000Z'))).toBe('2027-01-01');
    });

    /**
     * Built from the shifted instant's UTC parts, never local ones — otherwise
     * the boundary depends on where the process happens to run, and a student's
     * day would move when the server did.
     */
    it('does not depend on the server’s own timezone', () => {
      const before = process.env.TZ;
      try {
        process.env.TZ = 'America/Los_Angeles';
        const west = addisDate(new Date('2026-08-08T21:00:00.000Z'));
        process.env.TZ = 'Asia/Tokyo';
        const east = addisDate(new Date('2026-08-08T21:00:00.000Z'));
        expect(west).toBe(east);
        expect(west).toBe('2026-08-09');
      } finally {
        if (before === undefined) delete process.env.TZ;
        else process.env.TZ = before;
      }
    });
  });

  describe('who gets a message', () => {
    it('sends to an opted-in student who has not had one today', () => {
      expect(decideDaily(candidate(), '2026-08-08')).toEqual({
        userId: 'u1',
        send: true,
        skip: null,
      });
    });

    /** T-181's stated test: running the job twice in a day sends once. */
    it('does not send twice in one day', () => {
      const first = planDaily([candidate()], '2026-08-08');
      expect(first.send).toHaveLength(1);

      // What the job writes back after sending.
      const second = planDaily([candidate({ lastDailySentOn: '2026-08-08' })], '2026-08-08');
      expect(second.send).toHaveLength(0);
      expect(second.skipped[0]!.skip).toBe('already-sent');
    });

    it('sends again the next day', () => {
      const plan = planDaily([candidate({ lastDailySentOn: '2026-08-08' })], '2026-08-09');
      expect(plan.send).toHaveLength(1);
    });

    /** T-182's stated test: an opted-out student receives nothing. */
    it('sends nothing to someone who opted out', () => {
      const plan = planDaily([candidate({ botOptOut: true })], '2026-08-08');
      expect(plan.send).toHaveLength(0);
      expect(plan.skipped[0]!.skip).toBe('opted-out');
    });

    /**
     * Opting out wins over every other reason, so "why did this person get
     * nothing" answers with the reason that will still be true tomorrow.
     */
    it('reports opting out even when another reason also applies', () => {
      const plan = planDaily(
        [candidate({ botOptOut: true, lastDailySentOn: '2026-08-08', chatId: null })],
        '2026-08-08',
      );
      expect(plan.skipped[0]!.skip).toBe('opted-out');
    });

    // A student who signed in on the web but never opened the bot has no chat
    // to send to. Not an error — there is simply nowhere to put the message.
    it('skips a student the bot has no chat with', () => {
      const plan = planDaily([candidate({ chatId: null })], '2026-08-08');
      expect(plan.send).toHaveLength(0);
      expect(plan.skipped[0]!.skip).toBe('no-chat');
    });

    it('splits a mixed batch and accounts for everybody', () => {
      const batch = [
        candidate({ userId: 'send-me' }),
        candidate({ userId: 'opted-out', botOptOut: true }),
        candidate({ userId: 'had-it', lastDailySentOn: '2026-08-08' }),
        candidate({ userId: 'no-chat', chatId: null }),
      ];
      const plan = planDaily(batch, '2026-08-08');
      expect(plan.send.map((d) => d.userId)).toEqual(['send-me']);
      expect(plan.skipped).toHaveLength(3);
      expect(plan.send.length + plan.skipped.length).toBe(batch.length);
    });

    it('handles an empty batch', () => {
      expect(planDaily([], '2026-08-08')).toEqual({
        today: '2026-08-08',
        send: [],
        skipped: [],
      });
    });
  });
});

describe('referral codes on /start (T-180)', () => {
  /** T-180's stated test. */
  it('recognises a referral payload', () => {
    expect(referralFromPayload('amb_123')).toBe('amb_123');
  });

  /**
   * Deliberately narrow. `/start` also carries login nonces (T-075), and a
   * mis-attributed referral is a payment to the wrong person — invisible until
   * somebody queries the numbers.
   */
  it('is not fooled by the other things /start carries', () => {
    expect(referralFromPayload('login_9f3a')).toBeNull();
    expect(referralFromPayload('')).toBeNull();
    expect(referralFromPayload('amb_')).toBeNull();
  });

  it('refuses characters Telegram would not carry', () => {
    expect(referralFromPayload('amb_has spaces')).toBeNull();
    expect(referralFromPayload('amb_a.b')).toBeNull();
    expect(referralFromPayload(`amb_${'x'.repeat(49)}`)).toBeNull();
  });

  it('keeps the whole payload, prefix and all', () => {
    // Stored as given, so the value in the database is the value in the link
    // somebody handed out — the thing an ambassador will quote when they ask.
    expect(referralFromPayload('amb_teacher-42')).toBe('amb_teacher-42');
    expect(REFERRAL_PREFIX).toBe('amb_');
  });
});
