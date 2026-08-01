/**
 * The publish gate — the rule that makes this product defensible.
 *
 * A question may only be served if the platform can explain it. Everything here
 * is checked server-side on every publish; `apps/web` mirrors these rules for
 * live feedback in the creator form, but this copy is authoritative.
 *
 * Returns a LIST of blockers rather than throwing on the first one: a reviewer
 * fixing a question wants to see everything wrong with it at once, and the
 * submit button shows the remaining count ("2 why-wrongs missing").
 *
 * Prisma-free by design, so it is testable without a database and usable from
 * the importer, the creator form and the review queue alike.
 */

export type DraftOptionLabel = 'A' | 'B' | 'C' | 'D';

export interface DraftOption {
  label: DraftOptionLabel;
  text: string;
  isCorrect: boolean;
  /** Why this option is wrong. Required on distractors — see T-041. */
  whyWrong?: string | null;
}

export interface DraftStep {
  stepNo: number;
  text: string;
  formula?: string | null;
}

export interface DraftQuestion {
  qType: 'CONCEPT' | 'CALCULATION';
  stem: string;
  conceptLine?: string | null;
  explanation?: string | null;
  steps?: readonly DraftStep[];
  timeLimitSec?: number;
  options: readonly DraftOption[];
}

/**
 * Every reason this question may not be published, in the order a reviewer
 * would want to fix them. Empty array = publishable.
 */
export function gateBlockers(q: DraftQuestion): string[] {
  const blockers: string[] = [];

  // T-040 — exactly one correct answer.
  //
  // Zero means nobody has verified the answer; CONTENT-PIPELINE.md says five of
  // eight source files arrived with no key at all, so this is the common case,
  // not an edge one. Two means the bank contradicts itself, which is worse than
  // having no question: a student who picks the "other" correct answer is
  // marked wrong and told why they were wrong when they were not.
  const correct = q.options.filter((o) => o.isCorrect);
  if (correct.length !== 1) {
    blockers.push(
      correct.length === 0
        ? 'No correct option marked — a reviewer must supply and confirm the answer.'
        : `Exactly one correct option (have ${correct.length}: ${correct.map((o) => o.label).join(', ')}).`,
    );
  }

  // T-041 — every distractor explains why it tempted the student.
  //
  // One blocker per offending option, not a single summary line: the creator
  // form anchors each message to its own field, and a reviewer needs to know
  // WHICH letter is unexplained, not merely that something is.
  //
  // The correct option carries no why-wrong — it is explained by the concept
  // line plus the explanation or the worked steps.
  //
  // This is the rule the whole product rests on. CONTENT-PIPELINE.md records
  // that ZERO authored explanations exist in any source file, so on real
  // imported content this blocker fires on every distractor of every question
  // until someone writes them. That is the honest state, not a bug.
  for (const o of q.options) {
    if (o.isCorrect) continue;
    if (!o.whyWrong || o.whyWrong.trim() === '') {
      blockers.push(`Option ${o.label}: why it is wrong is missing.`);
    }
  }

  // T-042 — a concept line, and exactly one sentence of it.
  //
  // It is the "what was being tested" anchor, shown before any solution. One
  // sentence is the whole point: a paragraph there is a second explanation, and
  // the student stops reading the thing they were meant to remember.
  const concept = (q.conceptLine ?? '').trim();
  if (concept === '') {
    blockers.push('Concept line is missing.');
  } else if (countSentences(concept) > 1) {
    blockers.push('Concept line must be a single sentence — split it or shorten it.');
  }

  return blockers;
}

/**
 * Sentence count, tolerant of the things that look like sentence ends but are not.
 *
 * A naive `/[.!?]\s+\S/` flags "extract with ×15/115, e.g. 150,000." as two
 * sentences and would reject a perfectly good concept line, so common
 * abbreviations are masked first. Decimals need no special handling: "1.15" has
 * no whitespace after the point.
 */
/**
 * Kept deliberately short. Every entry here is a word the checker will stop
 * treating as a sentence end, so a common word costs real detection: `no.` was
 * in this list and made "The answer is no. It is not deductible." — two plain
 * sentences — pass. Only abbreviations that genuinely appear mid-concept-line
 * earn a place, and each is tested.
 */
const ABBREVIATIONS = /\b(e\.g|i\.e|etc|vs|cf|approx)\./gi;

function countSentences(text: string): number {
  const masked = text.replace(ABBREVIATIONS, (m) => '·'.repeat(m.length));
  // A terminator followed by whitespace and more content starts a new sentence.
  const interior = masked.match(/[.!?]+\s+\S/g)?.length ?? 0;
  return interior + 1;
}

/** True when nothing blocks publication. */
export function isPublishable(q: DraftQuestion): boolean {
  return gateBlockers(q).length === 0;
}
