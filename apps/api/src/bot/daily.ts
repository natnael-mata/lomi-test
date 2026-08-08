/**
 * The daily question's day boundary and eligibility (T-181, T-182), with no
 * database involved.
 *
 * **A calendar day in Addis, not a rolling 24 hours.** The obvious guard is
 * `lastSentAt < now - 24h`, and it drifts: a job that runs a minute late pushes
 * every subsequent send a minute later, until a "morning" question arrives at
 * 3am. A student's day is the one on their wall, so the guard is a date string
 * and the comparison is equality.
 *
 * Ethiopia is UTC+3 with no daylight saving, which is what makes this a fixed
 * offset rather than a timezone database — the same reasoning `startOfToday()`
 * uses in `practice.service.ts` for "the same day" in T-110. Both must agree, or
 * a student gets today's question after their practice day has already rolled.
 */

/** UTC+3, year-round. No daylight saving in Ethiopia. */
export const ADDIS_OFFSET_MINUTES = 3 * 60;

/**
 * The calendar date in Addis, as `YYYY-MM-DD`.
 *
 * Built from the shifted instant's **UTC** parts, never the local ones: the
 * server's own zone is not a fact about the student, and reading local parts
 * would make the boundary depend on where the process happens to run.
 */
export function addisDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + ADDIS_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface DailyCandidate {
  userId: string;
  chatId: string | null;
  botOptOut: boolean;
  lastDailySentOn: string | null;
}

export type SkipReason = 'opted-out' | 'already-sent' | 'no-chat';

export interface DailyDecision {
  userId: string;
  send: boolean;
  skip: SkipReason | null;
}

/**
 * Whether one student should get today's question.
 *
 * The order matters for what gets reported, not for the outcome: an opted-out
 * student is reported as opted out even if they also happen to have been sent
 * to today, because "why did this person get nothing" should answer with the
 * reason that will still be true tomorrow.
 */
export function decideDaily(candidate: DailyCandidate, today: string): DailyDecision {
  const skip: SkipReason | null = candidate.botOptOut
    ? 'opted-out'
    : candidate.lastDailySentOn === today
      ? 'already-sent'
      : candidate.chatId === null
        ? 'no-chat'
        : null;

  return { userId: candidate.userId, send: skip === null, skip };
}

export interface DailyPlan {
  today: string;
  send: DailyDecision[];
  skipped: DailyDecision[];
}

/** Splits a batch into who gets a message and who does not, with reasons. */
export function planDaily(
  candidates: readonly DailyCandidate[],
  today: string = addisDate(),
): DailyPlan {
  const decisions = candidates.map((c) => decideDaily(c, today));
  return {
    today,
    send: decisions.filter((d) => d.send),
    skipped: decisions.filter((d) => !d.send),
  };
}

/**
 * Whether a `/start` payload is a referral code (T-180).
 *
 * Deliberately narrow. `/start` also carries login nonces (T-075) and will carry
 * whatever is added next, so anything unrecognised is **not** a referral rather
 * than being recorded as one — a mis-attributed referral is a payment to the
 * wrong person, and it is invisible until somebody queries the numbers.
 */
export const REFERRAL_PREFIX = 'amb_';

export function referralFromPayload(payload: string): string | null {
  if (!payload.startsWith(REFERRAL_PREFIX)) return null;
  const code = payload.slice(REFERRAL_PREFIX.length);
  // Same alphabet Telegram will actually carry in a start payload.
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(code)) return null;
  return payload;
}
