'use client';

/**
 * The error boundary every route falls back to (T-208).
 *
 * App Router boundaries nest: this one at the app root catches anything a route
 * segment does not catch itself, which is what makes "every route" true without
 * a file per screen. A screen that needs to say something more specific adds its
 * own `error.tsx` beside its page and this one stops being reached.
 *
 * **A recovery action, not an apology.** `reset()` re-renders the segment
 * without a full reload, which is the difference between a student losing their
 * place mid-sitting and not — the exam screen re-reads its state from the server
 * on mount, so recovering here costs them nothing.
 *
 * The message names what a person can do. "Something went wrong" is the wording
 * that generates a support ticket, because it leaves the student with no move.
 */
import { useEffect } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what ties this screen to a server log line. Logged rather
    // than shown: it means nothing to a student and everything to support, and
    // T-207 keeps the log itself free of anything personal.
    /*
     * The digest is the only thread from this screen back to a server log line,
     * and it is the first thing support asks for. Structured logging arrives in
     * T-207; until then this is the record.
     */
    // eslint-disable-next-line no-console -- see above
    console.error('route error', { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-4">
      <Card data-error-boundary="route">
        <h1 className="text-title">That did not load</h1>
        <p className="text-body text-ink-2 mt-2">
          Nothing you have answered is lost — your work is saved as you go. Try again, and if it
          keeps happening, tell support{error.digest ? ` and quote ${error.digest}` : ''}.
        </p>
        <Button className="mt-4" onClick={reset} data-recover="">
          Try again
        </Button>
      </Card>
    </main>
  );
}
