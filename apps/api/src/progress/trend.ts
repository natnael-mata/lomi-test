/**
 * The score trend across mock sittings (T-138), with no database involved.
 *
 * **Labelled by sitting, never by date.** "Mock 1, Mock 2, Mock 3" and not
 * "12 Jul, 28 Jul, 3 Aug", for two reasons that both matter more than they look:
 *
 * 1. A date axis spaces points by calendar time, so a student who sat two mocks
 *    in a week and a third two months later gets a chart whose shape is about
 *    their holiday rather than their revision. The interesting sequence is the
 *    order they sat them in.
 * 2. Ethiopia uses its own calendar alongside the Gregorian one. A date on an
 *    axis is a formatting decision with a right and a wrong answer per student,
 *    and an ordinal has neither.
 *
 * The date is still carried on each point, so a tooltip can show it. It is just
 * not what the axis is made of.
 */

export interface SittingInput {
  sittingId: string;
  /** ISO 8601, for a tooltip. Never the axis label. */
  startedAt: string;
  scoreCorrect: number;
  totalQuestions: number;
  answeredCount: number;
  ranOutOfTime: boolean;
}

export interface SittingPoint extends SittingInput {
  /** 1-based position in the student's own sequence of mocks. */
  ordinal: number;
  /** What the axis shows: "Mock 1". */
  label: string;
  scorePct: number;
  /**
   * Questions never reached, because time ran out.
   *
   * Reported so a chart can say why a score dipped. A mock that expired at
   * question 60 is not the same story as one finished badly, and a trend line
   * that cannot tell them apart teaches a student the wrong lesson about what to
   * fix.
   */
  unanswered: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Numbers a student's sittings in the order they sat them. */
export function labelSittings(sittings: readonly SittingInput[]): SittingPoint[] {
  return sittings.map((sitting, index) => ({
    ...sitting,
    ordinal: index + 1,
    label: `Mock ${index + 1}`,
    scorePct:
      sitting.totalQuestions === 0
        ? 0
        : round1((sitting.scoreCorrect / sitting.totalQuestions) * 100),
    unanswered: Math.max(0, sitting.totalQuestions - sitting.answeredCount),
  }));
}

/**
 * The change between the first and last mock, or `null` with fewer than two.
 *
 * `null` rather than 0: one mock is not a flat trend, it is no trend, and
 * drawing "no change" from a single point tells a student something nobody
 * knows.
 */
export function trendDeltaPct(points: readonly SittingPoint[]): number | null {
  if (points.length < 2) return null;
  return round1(points[points.length - 1]!.scorePct - points[0]!.scorePct);
}
