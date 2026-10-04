/**
 * TODO(pass mark): the mark a paper is graded against, or null.
 *
 * The handoff prints "graded against the 50% pass mark" and an "Above the 50%
 * pass mark" badge on every result. Nothing in this product says what the pass
 * mark is, and the school tracks are not sat against the university exit
 * exam's, so printing 50 would be an invented claim on the screen a student
 * reads their score from.
 *
 * Typed and wired: set this (or replace it with a per field value from the
 * API) and the Mocks subtitle and the badge on the results appear. Until then
 * neither renders. Listed in the redesign's open items.
 *
 * Read by Mocks (the subtitle) and by the results page (the badge).
 */
export const PASS_MARK_PCT: number | null = null;
