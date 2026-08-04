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
    readonly code: 'UNWEIGHTED_TOPIC' | 'NO_TOPICS' | 'SUM_MISMATCH' | 'NO_PUBLISHED_QUESTIONS',
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

/** A topic and how many published questions it has, the input to deriving. */
export interface TopicCount {
  topicId: string;
  name: string;
  publishedCount: number;
}

export interface DerivedWeight {
  topicId: string;
  name: string;
  /** Whole percent, 0–100. The set always sums to exactly 100. */
  weightPct: number;
}

/**
 * Derives each topic's weight from its share of the field's published bank (D5).
 *
 * **What this is a claim about.** The weight says how much of the *material that
 * has been published* belongs to a topic. It is a proxy for a topic's share of
 * past papers, and it is only as good as the bank: a topic nobody has finished
 * importing looks small because it *is* small, here. That is why every screen
 * captions it "share of past papers" and never "% of the exam" — and why T-134a
 * exists, so a reviewer who knows better can say so.
 *
 * **Largest remainder, not per-topic rounding.** Rounding each share on its own
 * does not sum: three topics with equal counts are 33.33% each and round to
 * 33 + 33 + 33 = 99, so the weights fail `assertWeightsSumTo100` and the field
 * cannot publish, for a reason no reviewer can act on. Largest remainder gives
 * everyone their floor and hands the leftovers to whoever was rounded down
 * hardest, so the parts always sum to the whole — [34, 33, 33].
 *
 * Ties break on name, so the same bank always derives the same weights. A field
 * whose weights shuffle between two runs would move questions between topics on
 * every rebuild of a paper.
 */
export function deriveWeights(topics: readonly TopicCount[]): DerivedWeight[] {
  if (topics.length === 0) {
    throw new WeightsError('No topics to weight.', 'NO_TOPICS');
  }

  const total = topics.reduce((sum, t) => sum + Math.max(0, t.publishedCount), 0);
  if (total === 0) {
    // Refused rather than returning all zeros. Zeros would sum to 0, fail the
    // 100 check downstream, and surface as "weights are broken" when the real
    // situation is that nothing has been published yet.
    throw new WeightsError(
      'No published questions in this field yet, so there is nothing to derive weights from.',
      'NO_PUBLISHED_QUESTIONS',
    );
  }

  const exact = topics.map((t) => (Math.max(0, t.publishedCount) * 100) / total);
  const floors = exact.map((e) => Math.floor(e));
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);

  const order = topics
    .map((topic, index) => ({
      index,
      remainder: exact[index]! - floors[index]!,
      name: topic.name,
    }))
    .sort((a, b) => b.remainder - a.remainder || a.name.localeCompare(b.name));

  const weights = [...floors];
  for (const { index } of order) {
    if (remaining <= 0) break;
    weights[index] = weights[index]! + 1;
    remaining -= 1;
  }

  return topics.map((topic, index) => ({
    topicId: topic.topicId,
    name: topic.name,
    weightPct: weights[index]!,
  }));
}

/**
 * Applies a reviewer's override and re-normalises everything else around it
 * (T-134a).
 *
 * The overridden topic gets exactly what was asked for. The remaining 100 minus
 * that is split across the others **in proportion to their derived weights**,
 * not equally — a reviewer correcting one topic is not also claiming the rest
 * are identical, and flattening them would silently discard the evidence from
 * the bank.
 *
 * A second override is applied over the first, so overrides compose rather than
 * the last one winning outright.
 */
export function applyOverrides(
  derived: readonly DerivedWeight[],
  overrides: ReadonlyMap<string, number>,
): DerivedWeight[] {
  const pinned = derived.filter((d) => overrides.has(d.topicId));
  if (pinned.length === 0) return derived.map((d) => ({ ...d }));

  const pinnedTotal = pinned.reduce((sum, d) => sum + overrides.get(d.topicId)!, 0);
  const free = derived.filter((d) => !overrides.has(d.topicId));
  const budget = 100 - pinnedTotal;

  if (budget < 0) {
    throw new WeightsError(
      `Overrides sum to ${pinnedTotal}%, which leaves nothing for the other topics.`,
      'SUM_MISMATCH',
    );
  }

  const result = new Map<string, number>();
  for (const topic of pinned) result.set(topic.topicId, overrides.get(topic.topicId)!);

  if (free.length > 0) {
    // Largest remainder again, over the free topics' own derived weights, so the
    // leftover budget lands where the bank says it belongs.
    const freeTotal = free.reduce((sum, d) => sum + d.weightPct, 0);
    const exact = free.map((d) =>
      freeTotal === 0 ? budget / free.length : (d.weightPct * budget) / freeTotal,
    );
    const floors = exact.map((e) => Math.floor(e));
    let remaining = budget - floors.reduce((a, b) => a + b, 0);

    const order = free
      .map((topic, index) => ({
        index,
        remainder: exact[index]! - floors[index]!,
        name: topic.name,
      }))
      .sort((a, b) => b.remainder - a.remainder || a.name.localeCompare(b.name));

    const shares = [...floors];
    for (const { index } of order) {
      if (remaining <= 0) break;
      shares[index] = shares[index]! + 1;
      remaining -= 1;
    }
    free.forEach((topic, index) => result.set(topic.topicId, shares[index]!));
  } else if (budget !== 0) {
    throw new WeightsError(
      `Every topic is overridden but the overrides sum to ${pinnedTotal}%, not 100%.`,
      'SUM_MISMATCH',
    );
  }

  return derived.map((d) => ({ ...d, weightPct: result.get(d.topicId)! }));
}
