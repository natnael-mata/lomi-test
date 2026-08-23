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
  /** When it settled. Null only if a sitting is somehow still open. */
  closedAt: string | null;
  scoreCorrect: number;
  totalQuestions: number;
  answeredCount: number;
  ranOutOfTime: boolean;
  /**
   * The deadline the paper actually had.
   *
   * Needed because `closedAt` is not when the student stopped. A paper that runs
   * out of time stays open in the database until something sweeps it, and the
   * sweeper is the student's *next* action — so a paper abandoned on a Tuesday
   * and swept on a Wednesday reported nineteen hours of work. QA read "1132 min
   * used" on a 45-minute paper and filed it as a timing bug; it was, and this is
   * the missing number.
   */
  endsAt: string;
}

export interface SittingPoint extends SittingInput {
  /**
   * Answered but wrong, and never answered — the two halves of a bad score.
   *
   * **Knowledge and pacing are opposite diagnoses.** A sitting reading 28% where
   * only 62 questions were attempted is 45% of what was attempted with 38 left
   * blank, and those are different problems with different fixes: one is study,
   * the other is a watch. A bare percentage tells a student neither, and the
   * three together sum to the paper, so the bar a client draws is checkable.
   */
  wrong: number;
  blank: number;
  /** Whole minutes between opening and closing, for the pacing half. */
  minutesUsed: number;
  /** 1-based position in the student's own sequence of mocks. */
  ordinal: number;
  /** What the axis shows: "Mock 1". */
  label: string;
  scorePct: number;
  /**
   * Questions with no answer on them. **Blank, never "ran out of time".**
   *
   * The figure counts blanks and knows nothing about why: a paper submitted
   * early leaves them too, and QA was once told they had run out of time on a
   * sitting they closed with eighteen minutes to spare. `ranOutOfTime` is a
   * separate flag, from the close reason, and that is the one entitled to say so.
   *
   * Kept alongside `blank`, which is the same number under the name the client
   * now uses; this stays for the existing trend note.
   */
  unanswered: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Numbers a student's sittings in the order they sat them. */
/**
 * Whole minutes from opening to closing, floored.
 *
 * Floored rather than rounded: "used 44 minutes of 45" is a true statement about
 * a paper that ran 44:50, and rounding it to 45 would say they used the lot.
 * Zero when a sitting is somehow still open — absent time is not negative time.
 */
/**
 * How long the student actually had the paper.
 *
 * Bounded by the deadline, never by when the row was settled. Closing is a
 * bookkeeping event that can happen arbitrarily later — the sweeper runs on the
 * student's next visit — and a figure that includes the wait says the student
 * sat there for it. Nobody spends more time on a paper than the paper allows.
 */
function minutesUsedOn(startedAt: string, closedAt: string | null, endsAt: string): number {
  if (closedAt === null) return 0;
  const started = new Date(startedAt).getTime();
  const stopped = Math.min(new Date(closedAt).getTime(), new Date(endsAt).getTime());
  const ms = stopped - started;
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 60_000) : 0;
}

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
    // The three that sum to the paper. A client draws one bar from them, and a
    // student can add them up against the total printed beside it.
    wrong: Math.max(0, sitting.answeredCount - sitting.scoreCorrect),
    blank: Math.max(0, sitting.totalQuestions - sitting.answeredCount),
    minutesUsed: minutesUsedOn(sitting.startedAt, sitting.closedAt, sitting.endsAt),
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
