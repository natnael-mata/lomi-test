/**
 * Topic weight arithmetic, kept free of Prisma so it can be tested without a
 * database and reused by the importer, the admin weight editor and readiness.
 *
 * All arithmetic is done in integer hundredths of a percent. `weightPct` is
 * `numeric(5,2)` in Postgres, so two decimal places is the full precision, and
 * integers make "sums to exactly 100" an exact comparison rather than a
 * floating-point near-miss.
 */

/** A topic's weight as loaded from the database. `null` = not yet derived. */
export interface TopicWeight {
  /** Used in error messages, so a human can find the offending topic. */
  name: string;
  /** Percentage, 0–100, to two decimal places. `null` when unweighted. */
  weightPct: number | null;
}

export class WeightsError extends Error {
  constructor(
    message: string,
    readonly code: 'UNWEIGHTED_TOPIC' | 'NO_TOPICS' | 'SUM_MISMATCH',
  ) {
    super(message);
    this.name = 'WeightsError';
  }
}

const HUNDREDTHS = 100;
const TARGET = 100 * HUNDREDTHS; // 100.00% expressed in hundredths

function toHundredths(pct: number): number {
  return Math.round(pct * HUNDREDTHS);
}

function fmt(hundredths: number): string {
  return (hundredths / HUNDREDTHS).toFixed(2);
}

/**
 * Throws unless the given weights sum to exactly 100.00%.
 *
 * The error names the shortfall or excess, because "weights must sum to 100" on
 * its own leaves a reviewer counting a long list by hand.
 */
export function assertWeightsSumTo100(topics: readonly TopicWeight[]): void {
  if (topics.length === 0) {
    throw new WeightsError(
      'No topics to weight. A field cannot publish until its topics exist and are weighted.',
      'NO_TOPICS',
    );
  }

  const unweighted = topics.filter((t) => t.weightPct === null).map((t) => t.name);
  if (unweighted.length > 0) {
    throw new WeightsError(
      `${unweighted.length} topic(s) have no weight: ${unweighted.join(', ')}.`,
      'UNWEIGHTED_TOPIC',
    );
  }

  const total = topics.reduce((sum, t) => sum + toHundredths(t.weightPct as number), 0);
  if (total === TARGET) return;

  const diff = TARGET - total;
  const direction = diff > 0 ? `short by ${fmt(diff)}` : `over by ${fmt(-diff)}`;
  throw new WeightsError(
    `Topic weights sum to ${fmt(total)}%, ${direction}% (must be 100.00%).`,
    'SUM_MISMATCH',
  );
}
