import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { RATE_LIMITS, decide, rateKey, withinWindow, type RateLimitName } from './rate-limit';

/**
 * 429, with the hint a client needs to behave (T-206).
 *
 * The status matters as much as the refusal. The sign-in limiter used to throw a
 * 422 with a `TOO_MANY_REQUESTS` code, which no client can act on correctly: 422
 * means "your input was wrong", so a retry is pointless, and a caller that
 * treats it as a hard failure gives up on somebody who only had to wait twelve
 * seconds.
 */
export class TooManyRequests extends HttpException {
  constructor(readonly retryAfterSec: number) {
    super(
      {
        error: 'TOO_MANY_REQUESTS',
        retryAfterSec,
        message: `Too many requests. Try again in ${retryAfterSec} second${
          retryAfterSec === 1 ? '' : 's'
        }.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * The rate limiter's store.
 *
 * **In memory, per process, and that is a stated limitation rather than an
 * oversight.** Behind two instances the effective limit is double; behind ten,
 * tenfold. For these limits that is acceptable — the numbers exist to stop
 * scripts and runaway retries, and a bound of 10× a human's pace is still a
 * bound — but it is not a quota and must never be relied on as one. Anything
 * that needs an exact count across instances (a paid allowance, a free-tier
 * cap) belongs in the database, which is where `freeRemaining` already lives.
 *
 * Entries are pruned on read rather than by a timer: a `setInterval` here would
 * keep the process alive in tests and, more importantly, would be one more thing
 * that can silently stop.
 */
@Injectable()
export class RateLimitService {
  private readonly hits = new Map<string, number[]>();

  /**
   * Records one request and throws if it is over the limit.
   *
   * The hit is recorded **only when allowed**. Counting refused requests too
   * would let somebody hold themselves out indefinitely by continuing to hammer
   * a limit they have already hit — the window would never drain.
   */
  consume(
    name: RateLimitName,
    identity: string | null,
    ip: string | null,
    now: number = Date.now(),
  ): void {
    const rule = RATE_LIMITS[name];
    const key = rateKey(name, identity, ip);
    const live = withinWindow(this.hits.get(key) ?? [], now, rule.windowSec);

    const verdict = decide(live, now, rule);
    if (!verdict.allowed) {
      // Pruned even on refusal, so a key that goes quiet stops holding memory.
      this.hits.set(key, live);
      throw new TooManyRequests(verdict.retryAfterSec);
    }

    this.hits.set(key, [...live, now]);
  }

  /** Test seam. Nothing in the application calls this. */
  reset(): void {
    this.hits.clear();
  }
}
