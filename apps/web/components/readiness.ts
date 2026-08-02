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
}

export interface ElidedRow {
  label: string;
  weightPct: number;
  topicCount: number;
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

/** The elided row's label — "58% across 12 other topics". */
export function elidedLabel(elided: ElidedRow): string {
  return elided.topicCount > 0 ? `${elided.topicCount} other topics` : `all other topics`;
}
