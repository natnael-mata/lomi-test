/**
 * The readiness statement's arithmetic (T-097).
 *
 * DESIGN.md: weights **sum to 100, including an explicit "N other topics" row
 * when rows are elided**, and the headline figure is their weighted mean.
 *
 * The elided row is the honest part. Showing six topics whose weights add to 42%
 * and a headline of "68% ready" invites a student to check the sum, fail, and
 * stop trusting the number — or worse, not check, and believe the six topics on
 * screen are the whole exam. The row says out loud that the rest exists.
 */

/** DESIGN.md: rows below this switch to Pending and gain a Focus chip. */
export const PASS_SAFE_PCT = 60;

export interface TopicScore {
  topic: string;
  /** The student's score on this topic, 0–100. */
  scorePct: number;
  /** This topic's share of past papers, 0–100. */
  weightPct: number;
  /**
   * How many answers the score rests on, when known. A 100% from one answer
   * and a 100% from forty are different facts, and the row says which.
   */
  answered?: number;
}

export interface ElidedRow {
  label: string;
  weightPct: number;
  topicCount: number;
  /**
   * The topics themselves, so they can be named rather than merely counted.
   *
   * These are topics with no answers on them — untested, not failed — which is
   * why they carry no percentage and sit outside the weighted mean. That part
   * is right and stays. Hiding *which* they are is a separate decision, and a
   * bad one: QA pointed out that a page this candid should not tuck the topic
   * a student has never touched behind the words "1 other topic". Not knowing
   * what you have not started is worse than a low score on it.
   */
  topics?: readonly string[];
}

export interface ReadinessStatement {
  rows: TopicScore[];
  /** Present when the listed rows do not account for the whole 100. */
  elided: ElidedRow | null;
  /** The weighted mean across every weight, listed and elided alike. */
  headlinePct: number;
  /** Rows below the pass-safe line, in weight order — what to practise next. */
  focus: TopicScore[];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Builds a readiness statement from the topics being listed.
 *
 * `elidedScorePct` is the student's score across everything not listed. It is
 * required rather than defaulted: assuming 0 would understate readiness and
 * assuming the listed average would flatter it, and both are the system putting
 * a number in a student's mouth. `null` means genuinely unknown, and the elided
 * weight is then excluded from the mean rather than guessed at.
 */
export function buildReadiness(
  listed: readonly TopicScore[],
  options: { totalWeightPct?: number; elidedScorePct?: number | null } = {},
): ReadinessStatement {
  const total = options.totalWeightPct ?? 100;
  const listedWeight = listed.reduce((acc, r) => acc + Math.round(r.weightPct * 100), 0) / 100;
  const remaining = round1(total - listedWeight);

  const elided: ElidedRow | null =
    remaining > 0
      ? {
          // Named, not numbered vaguely: "N other topics" is checkable against
          // the taxonomy, "Other" is not.
          label: 'other topics',
          weightPct: remaining,
          topicCount: 0,
        }
      : null;

  const elidedScore = options.elidedScorePct ?? null;

  let weighted = 0;
  let weightUsed = 0;
  for (const row of listed) {
    weighted += row.scorePct * row.weightPct;
    weightUsed += row.weightPct;
  }
  if (elided && elidedScore !== null) {
    weighted += elidedScore * elided.weightPct;
    weightUsed += elided.weightPct;
  }

  return {
    rows: [...listed],
    elided,
    headlinePct: weightUsed === 0 ? 0 : round1(weighted / weightUsed),
    focus: listed
      .filter((r) => r.scorePct < PASS_SAFE_PCT)
      .sort((a, b) => b.weightPct - a.weightPct),
  };
}

/**
 * The elided row's label — "58% across 12 other topics".
 *
 * Singular when there is one of them. "1 other topics" is the kind of small
 * wrongness that makes a reader stop trusting the figures beside it, and this
 * row exists precisely so the weights visibly add up.
 */
/** How many are named before the label falls back to a count. */
const NAME_UP_TO = 3;

export function elidedLabel(elided: ElidedRow): string {
  if (elided.topicCount <= 0) return 'all other topics';

  /*
   * Named while naming them is still readable.
   *
   * Past three, a list is worse than a count — it stops being something to act
   * on and becomes a paragraph in a table cell. Below it, the names are the
   * whole point: "Value Added Tax, not started" is a next step, "1 other
   * topic" is a shrug.
   */
  const named = elided.topics ?? [];
  if (named.length > 0 && named.length <= NAME_UP_TO) {
    return `${named.join(', ')}, not started`;
  }
  return `${elided.topicCount} other topic${elided.topicCount === 1 ? '' : 's'}, not started`;
}
