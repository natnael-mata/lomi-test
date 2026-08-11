/**
 * Fixed-window rate limiting (T-206), with no storage and no clock of its own.
 *
 * **A sliding window over kept timestamps, not a counter that resets.** A plain
 * counter cleared every minute lets somebody spend the whole allowance at 11:59
 * and the whole of it again at 12:00 — double the limit across two seconds,
 * which is exactly the burst a limit exists to stop. Keeping the hit times and
 * discarding the ones that have aged out costs a small array per key and removes
 * the edge entirely.
 *
 * **`retryAfterSec` is computed from the oldest hit still in the window**, so it
 * is the true wait rather than the window length. Telling somebody to wait ten
 * minutes when they could go again in twelve seconds is how a limit turns into
 * an outage for an honest user who mistyped once.
 */

export interface RateRule {
  /** How many are allowed inside the window. */
  limit: number;
  windowSec: number;
}

export interface RateDecision {
  allowed: boolean;
  /** How many remain after this one. Zero when the request is refused. */
  remaining: number;
  /** Whole seconds until the next one would be allowed. Zero when allowed. */
  retryAfterSec: number;
}

/**
 * The limits, in one place so they can be read together.
 *
 * Numbers chosen for what a person does, not for what a server can take:
 *
 * - `signIn` — five links in ten minutes. A student retrying a flaky connection
 *   might need three; a script filling somebody's chat with approval prompts
 *   wants hundreds.
 * - `attempt` — a question has a time limit of at least fifteen seconds
 *   (`TIME_LIMIT_SEC`), so answering faster than four a minute sustained is not
 *   somebody reading the question. Set well above that so a fast student on
 *   short questions is never touched.
 * - `payment` — deliberately tight. Every attempt costs money somewhere and a
 *   retry loop against a provider is the kind of bug that arrives as an invoice.
 */
export const RATE_LIMITS = {
  signIn: { limit: 5, windowSec: 600 },
  attempt: { limit: 60, windowSec: 60 },
  payment: { limit: 5, windowSec: 300 },

  /**
   * Community posting (T-197).
   *
   * Two windows, not one. Five a minute stops a flood; forty an hour stops a
   * slow one. Somebody answering three classmates quickly is not the failure
   * being prevented, and a limit that catches ordinary enthusiasm gets worked
   * around rather than respected.
   */
  communityPost: { limit: 5, windowSec: 60 },
  communityPostHourly: { limit: 40, windowSec: 3600 },
} as const satisfies Record<string, RateRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Drops the hits that have aged out of the window. */
export function withinWindow(hits: readonly number[], now: number, windowSec: number): number[] {
  const cutoff = now - windowSec * 1000;
  return hits.filter((hit) => hit > cutoff);
}

/**
 * Whether one more request is allowed, given the hits already inside the window.
 *
 * Pure: the caller owns the store and the clock, which is what lets the whole
 * policy be tested without either.
 */
export function decide(hits: readonly number[], now: number, rule: RateRule): RateDecision {
  const live = withinWindow(hits, now, rule.windowSec);

  if (live.length < rule.limit) {
    return { allowed: true, remaining: rule.limit - live.length - 1, retryAfterSec: 0 };
  }

  // The oldest live hit is the one whose expiry frees a slot.
  const oldest = Math.min(...live);
  const freesAt = oldest + rule.windowSec * 1000;
  return {
    allowed: false,
    remaining: 0,
    // Rounded UP and floored at one: a `Retry-After: 0` invites an immediate
    // retry that is refused again, which reads to a client as a loop.
    retryAfterSec: Math.max(1, Math.ceil((freesAt - now) / 1000)),
  };
}

/**
 * The key a limit is counted against.
 *
 * **Per user where there is one, per address otherwise.** An address alone is
 * wrong for a product used in computer labs and on shared mobile NAT — one
 * student answering quickly would lock out the room. An identity alone is wrong
 * for sign-in, where there is no identity yet, which is the moment abuse is
 * cheapest.
 */
export function rateKey(name: RateLimitName, identity: string | null, ip: string | null): string {
  return `${name}:${identity ? `u:${identity}` : `ip:${ip ?? 'unknown'}`}`;
}
