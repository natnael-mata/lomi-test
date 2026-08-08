import { describe, expect, it } from 'vitest';

import { RATE_LIMITS, decide, rateKey, withinWindow } from './rate-limit';
import { RateLimitService, TooManyRequests } from './rate-limit.service';

const RULE = { limit: 3, windowSec: 60 };
const T0 = 1_000_000;

/** `n` hits, one per second, ending at `end`. */
const hits = (n: number, end = T0): number[] =>
  Array.from({ length: n }, (_, i) => end - (n - 1 - i) * 1000);

describe('the rate limit decision (T-206)', () => {
  it('allows requests below the limit', () => {
    expect(decide(hits(2), T0, RULE)).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterSec: 0,
    });
  });

  it('allows the very first request', () => {
    expect(decide([], T0, RULE).allowed).toBe(true);
    expect(decide([], T0, RULE).remaining).toBe(2);
  });

  it('refuses the one past the limit', () => {
    const verdict = decide(hits(3), T0, RULE);
    expect(verdict.allowed).toBe(false);
    expect(verdict.remaining).toBe(0);
  });

  /**
   * The reason this keeps timestamps rather than a counter.
   *
   * A counter cleared at the end of each window lets somebody spend the whole
   * allowance at 11:59:59 and the whole of it again at 12:00:00 — twice the
   * limit across two seconds, which is precisely the burst a limit exists to
   * stop.
   */
  it('does not let a window boundary double the allowance', () => {
    const atEnd = hits(3, T0);
    // One second later, still inside the window: refused.
    expect(decide(atEnd, T0 + 1000, RULE).allowed).toBe(false);
    // Only once the oldest has actually aged out does a slot free.
    expect(decide(atEnd, T0 + 61_000, RULE).allowed).toBe(true);
  });

  /**
   * The wait is until the oldest hit expires, not the whole window. Telling
   * somebody to wait ten minutes when they could go again in twelve seconds is
   * how a limit becomes an outage for a person who mistyped once.
   */
  it('says how long the wait actually is', () => {
    // Three hits at T0-2s, T0-1s, T0. The first frees a slot 60s after itself.
    expect(decide(hits(3), T0, RULE).retryAfterSec).toBe(58);
  });

  // A `Retry-After: 0` invites an immediate retry that is refused again, which
  // a client reads as a loop.
  it('never says zero when it is refusing', () => {
    // All three still inside the window, with the oldest a millisecond from
    // expiring — the case where a naive floor would compute 0.
    const verdict = decide([T0 - 59_999, T0 - 100, T0 - 50], T0, RULE);
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('drops hits that have aged out', () => {
    const old = [T0 - 120_000, T0 - 90_000, T0 - 1000];
    expect(withinWindow(old, T0, 60)).toEqual([T0 - 1000]);
  });

  it('forgets everything after a quiet window', () => {
    expect(decide(hits(3), T0 + 300_000, RULE).allowed).toBe(true);
  });
});

describe('what a limit is counted against', () => {
  /**
   * Per user where there is one, per address otherwise. An address alone locks
   * out a computer lab or a shared mobile NAT the moment one student works
   * quickly; an identity alone is useless at sign-in, where there is no identity
   * yet and abuse is cheapest.
   */
  it('prefers the identity over the address', () => {
    expect(rateKey('attempt', 'user-1', '10.0.0.1')).toContain('u:user-1');
    expect(rateKey('attempt', null, '10.0.0.1')).toContain('ip:10.0.0.1');
  });

  it('keeps different limits on different keys', () => {
    expect(rateKey('signIn', null, '10.0.0.1')).not.toBe(rateKey('attempt', null, '10.0.0.1'));
  });

  it('survives having neither', () => {
    expect(() => rateKey('signIn', null, null)).not.toThrow();
  });
});

describe('the limits themselves', () => {
  /**
   * Numbers chosen for what a person does. A question's minimum budget is
   * fifteen seconds, so four a minute sustained is already faster than reading;
   * the limit sits well above that so a fast student is never touched.
   */
  it('leaves room for a fast student', () => {
    expect(RATE_LIMITS.attempt.limit).toBeGreaterThan(4 * (RATE_LIMITS.attempt.windowSec / 60));
  });

  it('is tightest on payments, where every attempt costs money', () => {
    const perMinute = (r: { limit: number; windowSec: number }) => r.limit / (r.windowSec / 60);
    expect(perMinute(RATE_LIMITS.payment)).toBeLessThan(perMinute(RATE_LIMITS.attempt));
  });

  it('allows a handful of sign-in retries on a flaky connection', () => {
    expect(RATE_LIMITS.signIn.limit).toBeGreaterThanOrEqual(3);
  });
});

describe('the limiter service', () => {
  it('throws 429, not 422', () => {
    const limiter = new RateLimitService();
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i++) {
      limiter.consume('signIn', null, '10.0.0.1', T0 + i);
    }
    try {
      limiter.consume('signIn', null, '10.0.0.1', T0 + 100);
      expect.unreachable('should have refused');
    } catch (error) {
      expect(error).toBeInstanceOf(TooManyRequests);
      expect((error as TooManyRequests).getStatus()).toBe(429);
      expect((error as TooManyRequests).retryAfterSec).toBeGreaterThan(0);
    }
  });

  it('names the wait in the message a person sees, and in a field a client can read', () => {
    const body = new TooManyRequests(42).getResponse() as {
      message: string;
      retryAfterSec: number;
      error: string;
    };
    expect(body.message).toContain('42 seconds');
    // Both: the sentence is for the student, the number is for the client that
    // has to decide when to try again without parsing prose.
    expect(body.retryAfterSec).toBe(42);
    expect(body.error).toBe('TOO_MANY_REQUESTS');
  });

  it('says "1 second", not "1 seconds"', () => {
    expect((new TooManyRequests(1).getResponse() as { message: string }).message).toContain(
      '1 second.',
    );
  });

  it('counts each key separately', () => {
    const limiter = new RateLimitService();
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i++) {
      limiter.consume('signIn', null, '10.0.0.1', T0 + i);
    }
    // A different address is unaffected.
    expect(() => limiter.consume('signIn', null, '10.0.0.2', T0)).not.toThrow();
  });

  /**
   * Refused requests are not recorded.
   *
   * Counting them would let somebody hold themselves out indefinitely by
   * continuing to hammer a limit they have already hit — the window would never
   * drain, and the punishment for impatience would be permanent.
   */
  it('does not extend the block when somebody keeps trying', () => {
    const limiter = new RateLimitService();
    const rule = RATE_LIMITS.signIn;
    for (let i = 0; i < rule.limit; i++) limiter.consume('signIn', 'u1', null, T0);

    // Hammer it while blocked.
    for (let i = 0; i < 20; i++) {
      expect(() => limiter.consume('signIn', 'u1', null, T0 + i)).toThrow();
    }

    // The original window still expires on time.
    expect(() =>
      limiter.consume('signIn', 'u1', null, T0 + rule.windowSec * 1000 + 1),
    ).not.toThrow();
  });

  it('forgets a key that goes quiet', () => {
    const limiter = new RateLimitService();
    const rule = RATE_LIMITS.attempt;
    for (let i = 0; i < rule.limit; i++) limiter.consume('attempt', 'u1', null, T0);
    expect(() =>
      limiter.consume('attempt', 'u1', null, T0 + rule.windowSec * 1000 + 1),
    ).not.toThrow();
  });
});
