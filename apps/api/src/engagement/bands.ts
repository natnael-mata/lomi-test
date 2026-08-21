/**
 * Who competes against whom, and who is published at all (T-257).
 *
 * Pure: a band is a fact about a track's year span, and listing is a fact about
 * a band and a stored choice. Neither needs a database to decide, and both are
 * the kind of rule that should fail in a unit test rather than on a screen with
 * a child's name on it.
 */

export type Band = 'junior' | 'senior';

/** Above this year a student is senior. Grade 8 is the last junior year. */
export const JUNIOR_MAX_GRADE = 8;

/**
 * The band a track belongs to.
 *
 * Derived from the year span rather than stored, so adding a track cannot put
 * it in the wrong band by omission — a new Field with no band column would have
 * defaulted to *something*, and the something that gets defaulted to is how an
 * eleven-year-old ends up on an adult board.
 *
 * A track with no span at all is a university exit exam. Senior by definition:
 * its candidates are graduating from a degree.
 */
export function bandFor(maxGrade: number | null): Band {
  if (maxGrade === null) return 'senior';
  return maxGrade <= JUNIOR_MAX_GRADE ? 'junior' : 'senior';
}

/**
 * Whether this student's row may be published on a board.
 *
 * **The default inverts for juniors, deliberately.** T-194 made every student
 * listed unless they opted out, which is right for an adult deciding whether to
 * compete in public and wrong for a child who has not been asked. Grade 6 is
 * eleven years old and the parent — not the student — is the consent, so the
 * safe default is not to appear.
 *
 * The three states are the whole point:
 *
 * - `true` — asked to be hidden. Hidden in both bands, always. A "hide me" that
 *   can be overridden by a rule is not a choice.
 * - `false` — asked to appear. Listed in both bands.
 * - `null` — never asked. Listed if senior, hidden if junior.
 *
 * Opting out hides the row and **never the rank**: a student who does not want
 * to be seen competing still wants to know where they stand, and a product that
 * answers "you opted out" when asked "how am I doing" has punished somebody for
 * a privacy choice.
 */
export function isListed(band: Band, optOut: boolean | null): boolean {
  if (optOut === true) return false;
  if (optOut === false) return true;
  return band === 'senior';
}
