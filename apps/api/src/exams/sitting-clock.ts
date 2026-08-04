/**
 * The exam clock.
 *
 * **Instant arithmetic only.** Every function here works on `getTime()` deltas
 * and nothing else — no `setHours`, no `getHours`, no `toLocale*`. Practice's
 * `startOfToday()` answers a *civil-calendar* question ("which day is it for
 * this student") and is deliberately local-time; a sitting's deadline is a
 * duration from an instant, and mixing the two would make an exam expire three
 * hours early in Addis Ababa.
 *
 * `now` is a defaulted parameter everywhere, read once per request by the
 * caller, so the same instant is used for every decision in one operation.
 */
import type { SittingCloseReason } from '@prisma/client';

/**
 * How late an answer may arrive and still be written.
 *
 * Zero grace turns two seconds of mobile network into a silently lost answer:
 * the student pressed the button inside the limit and the packet arrived after
 * it. Five seconds clears one TCP retransmit on a congested link, is a twelfth
 * of the smallest per-question budget (60s) and 0.046% of a three-hour sitting —
 * too small to sit and think in, large enough to survive the network.
 *
 * It applies to **arrival**, not to the deadline: the sitting still closes at
 * `endsAt`, and a late-but-graced answer is written into a sitting that is
 * closing in the same breath.
 */
export const SUBMIT_GRACE_SEC = 5;

export interface SittingTimes {
  startedAt: Date;
  endsAt: Date;
  closedAt: Date | null;
}

/** When a sitting started plus its duration. The only place a deadline is made. */
export function deadlineFor(startedAt: Date, durationSec: number): Date {
  return new Date(startedAt.getTime() + durationSec * 1000);
}

/**
 * Seconds left, never negative.
 *
 * Clamped because a negative number reaches a UI that will render it: "-412s
 * remaining" is worse than "0", and a client doing `Math.floor(x / 60)` on it
 * shows "-7 minutes".
 */
export function remainingSec(endsAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.round((endsAt.getTime() - now.getTime()) / 1000));
}

export type SittingState = 'open' | 'expired' | 'closed';

/**
 * Liveness is **derived**, never stored as a status.
 *
 * A sitting the student abandoned is not "open" merely because nothing has run
 * to say otherwise — that would block their next start forever and inflate the
 * blast radius a retirement reports. `expired` means the time has passed but the
 * row has not settled yet; `closed` means it has.
 */
export function sittingState(sitting: SittingTimes, now: Date = new Date()): SittingState {
  if (sitting.closedAt !== null) return 'closed';
  return now.getTime() <= sitting.endsAt.getTime() ? 'open' : 'expired';
}

/** Whether an answer arriving now may still be written. */
export function acceptsAnswer(sitting: SittingTimes, now: Date = new Date()): boolean {
  if (sitting.closedAt !== null) return false;
  return now.getTime() <= sitting.endsAt.getTime() + SUBMIT_GRACE_SEC * 1000;
}

/** Why a sitting being settled now stopped. */
export function closeReasonFor(sitting: SittingTimes, now: Date = new Date()): SittingCloseReason {
  return now.getTime() > sitting.endsAt.getTime() ? 'EXPIRED' : 'SUBMITTED';
}

/**
 * The clock every exam response carries.
 *
 * `serverNow` goes out with it so a client can measure its own skew once rather
 * than trusting its clock, and so a support engineer reading a captured request
 * can see a wrong phone clock for what it is. The client never subtracts
 * `Date.now()` from anything — `remainingSec` is computed here.
 */
export interface SittingClock {
  serverNow: string;
  endsAt: string;
  durationSec: number;
  remainingSec: number;
  state: SittingState;
}

export function clockFor(
  sitting: SittingTimes,
  durationSec: number,
  now: Date = new Date(),
): SittingClock {
  return {
    serverNow: now.toISOString(),
    endsAt: sitting.endsAt.toISOString(),
    durationSec,
    remainingSec: remainingSec(sitting.endsAt, now),
    state: sittingState(sitting, now),
  };
}
