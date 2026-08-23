'use client';

/**
 * Reading a paper you sat earlier (T-129).
 *
 * **The review existed and could only be seen once.** `ExamReview` renders every
 * question, every wrong choice and every explanation — and it was reachable only
 * in the moments after submitting, from the sitting screen's own `closed` phase.
 * Leave that screen and the paper became a score: QA read "9 correct · 11 wrong"
 * on `/progress` and could not find out which eleven. For a product whose whole
 * claim is that the explanation is the thing being sold, that is the one screen
 * it cannot afford to lose.
 *
 * So this route is the same component behind a URL. Nothing about a closed
 * sitting needs protecting, and the server checks it belongs to the caller.
 */
import { useEffect, useState } from 'react';

import { ApiError, api, signInRequired, type SittingResult } from '../../../../lib/api';
import { copy } from '../../../../lib/i18n';
import { ExamReview } from '../../ExamReview';

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; result: SittingResult }
  | { kind: 'error'; message: string };

export function ReviewScreen({ sittingId }: { sittingId: string }) {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await api.examResult(sittingId);
        if (!cancelled) setPhase({ kind: 'ready', result });
      } catch (e) {
        if (signInRequired(e)) {
          window.location.assign('/signin');
          return;
        }
        if (cancelled) return;
        /*
         * A paper that is not yours and a paper that does not exist are one
         * message, deliberately. Sitting ids are opaque, but answering "that is
         * somebody else's" confirms it exists and belongs to a real account,
         * which is a fact nobody browsing ids is entitled to.
         */
        const missing = e instanceof ApiError && (e.status === 404 || e.status === 403);
        setPhase({
          kind: 'error',
          message: missing ? c.exam.reviewNotFound : c.exam.reviewFailed,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sittingId, c.exam.reviewNotFound, c.exam.reviewFailed]);

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.exam.reviewLoading}</p>;
  }

  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body">{phase.message}</p>
        {/* Somewhere to go. An error page whose only option is the back button
            is one a student leaves the product from. */}
        <a href="/progress" className="btn-ghost self-start">
          {c.exam.reviewBackToProgress}
        </a>
      </div>
    );
  }

  return <ExamReview result={phase.result} />;
}
