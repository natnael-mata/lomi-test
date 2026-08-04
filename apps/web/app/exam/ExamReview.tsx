'use client';

/**
 * The post-exam review (T-129, T-130).
 *
 * Everything unlocks at once. Nothing about a finished sitting needs protecting
 * any more, so there is no drip-feed, no "unlock the next explanation by…", and
 * no collapsed sections — the explanations are what the student is paying for
 * and a hundred of them behind taps is a hundred most people never open.
 *
 * The summary sits above the questions because it is the part that changes what
 * a student does tomorrow. The paper itself is the evidence for it.
 */
import { useState } from 'react';

import { AnswerView } from '../../components/AnswerView';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ExamSummary } from '../../components/ExamSummary';
import type { SittingResult } from '../../lib/api';

/** How many explanations to render before the student asks for the rest. */
const FIRST_PAGE = 10;

export function ExamReview({ result }: { result: SittingResult }) {
  // Not a disclosure control — every explanation is unlocked and reachable. A
  // hundred AnswerViews at once is simply a slow first paint on the phones this
  // is built for, so the rest arrive on request. The button says how many.
  const [shown, setShown] = useState(FIRST_PAGE);
  const visible = result.items.slice(0, shown);
  const rest = result.items.length - visible.length;

  const closedEarly = result.closeReason !== 'SUBMITTED';

  return (
    <div className="flex flex-col gap-6" data-exam-review="">
      <header className="flex flex-col gap-2">
        <h1 className="text-title">{result.examName}</h1>
        {closedEarly && (
          <Card data-closed-early="">
            <p className="text-body">
              The time ran out before you submitted. Everything you answered was kept.
            </p>
          </Card>
        )}
      </header>

      <ExamSummary summary={result} />

      <section className="flex flex-col gap-4" data-review-items="">
        <h2 className="text-title">Every question</h2>
        {visible.map((item) => (
          <article
            key={item.position}
            data-review-item={item.position}
            className="flex flex-col gap-2"
          >
            <p className="text-caption text-ink-2">Question {item.position}</p>
            <AnswerView
              answer={item.answerView}
              isCorrect={item.answerView.chosenLabel === item.answerView.correctLabel}
            />
          </article>
        ))}

        {rest > 0 && (
          <Button variant="ghost" onClick={() => setShown((n) => n + FIRST_PAGE)}>
            Show {Math.min(rest, FIRST_PAGE)} more
          </Button>
        )}
      </section>
    </div>
  );
}
