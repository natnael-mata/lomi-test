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
  /** Who wrote it. Compared against `reviewerId` — see T-044. */
  authorId?: string | null;
  /** Who is approving it. Absent while the question is still being written. */
  reviewerId?: string | null;
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

  // T-043 — the solution has to be complete for the question's type.
  if (q.qType === 'CALCULATION') {
    const steps = [...(q.steps ?? [])].sort((a, b) => a.stepNo - b.stepNo);
    if (steps.length === 0) {
      blockers.push('Add the worked steps — a calculation question needs its working shown.');
    } else if (correct.length === 1) {
      // Only checkable once the answer is known; with 0 or 2 correct options
      // the blocker above already covers it, and a second message about a
      // letter we cannot identify would just be noise.
      const label = correct[0]!.label;
      const last = steps[steps.length - 1]!;
      const text = `${last.text} ${last.formula ?? ''}`;
      if (!new RegExp(String.raw`\banswer\s+${label}\b`, 'i').test(text)) {
        blockers.push(`Final step must state the answer choice — e.g. "… → answer ${label}".`);
      }
    }
  } else if ((q.explanation ?? '').trim() === '') {
    // A CONCEPT question's explanation is the whole reward for getting it
    // wrong. Without one there is nothing to show after the verdict.
    blockers.push('Explanation is missing.');
  }

  // T-044 — nobody approves their own question.
  //
  // Review exists because the author already believes the question is right;
  // they are the one person who cannot catch their own wrong answer key. Only
  // checked when a reviewer is actually set: this same function runs live in the
  // creator form, where no reviewer exists yet, and "reviewer is missing" while
  // someone is still writing would be noise rather than guidance.
  //
  // Requiring a reviewer to be PRESENT belongs to the publish endpoint (T-067),
  // not here — the gate answers "is this question sound", not "has the workflow
  // been followed".
  if (q.reviewerId != null && q.authorId != null && q.reviewerId === q.authorId) {
    blockers.push('You wrote this question — someone else has to review it.');
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
