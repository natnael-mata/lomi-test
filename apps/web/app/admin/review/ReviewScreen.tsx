'use client';

/**
 * The review queue (T-231) — the screen that lets uploaded content reach a
 * student.
 *
 * **The gap this closes was worse than a missing screen.** Every imported row
 * lands `DRAFT`, correctly: nothing reaches a student without somebody reading
 * it. But `GET /admin/review/next` only serves `IN_REVIEW`, and nothing
 * anywhere listed drafts — so a thousand uploaded questions were invisible to
 * every screen in the product and reachable only with a database client.
 * Content could be loaded and could not be released.
 *
 * Two halves, in the order the work happens:
 *
 * 1. **The drafts**, each carrying the publish gate's own blockers. That is the
 *    answer to the only question somebody has after an upload — *what is
 *    missing* — and it comes from the server, computed by the same pure
 *    function the publish button runs, so the list cannot disagree with the
 *    outcome.
 * 2. **The one waiting on you**, in full, with publish and send-back.
 *
 * **Publishing is ADMIN-only and sending back is not.** A reviewer proposes; an
 * admin decides what a student reads. The screen shows both buttons to
 * everybody and lets the server refuse — the alternative is hiding the action
 * that explains the workflow from the people learning it.
 */
import { useCallback, useEffect, useState } from 'react';

import { Card } from '../../../components/Card';
import { Chip } from '../../../components/Chip';
import { Icon } from '../../../components/icons';
import { StatedFigure } from '../../../components/StatedFigure';
import { ApiError, api, signInRequired, type ReviewItem, type ReviewQueue } from '../../../lib/api';
import { copy } from '../../../lib/i18n';
import { QuestionEditor } from './QuestionEditor';

/** The shortest bounce note the server accepts. Mirrors `MIN_BOUNCE_NOTE`. */
const MIN_NOTE = 10;

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; queue: ReviewQueue; item: ReviewItem | null }
  | { kind: 'error'; message: string };

export function ReviewScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** The gate's reasons, when a publish was refused. Never a summary of them. */
  const [refused, setRefused] = useState<string[]>([]);

  const load = useCallback(async (): Promise<void> => {
    try {
      // Both at once: the counts and the question waiting are one picture, and
      // fetching them in sequence shows a queue of twelve above an empty
      // reviewer for as long as the second request takes.
      const [queue, item] = await Promise.all([
        api.reviewQueue(),
        api.reviewNext().catch(() => null),
      ]);
      setPhase({ kind: 'ready', queue, item });
    } catch (error) {
      if (signInRequired(error)) {
        window.location.assign('/signin');
        return;
      }
      setPhase({ kind: 'error', message: c.admin.review.couldNotLoad });
    }
  }, [c.admin.review.couldNotLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (what: 'submit' | 'publish' | 'bounce', id: string): Promise<void> => {
    if (what === 'bounce' && note.trim().length < MIN_NOTE) {
      setNotice(c.admin.review.bounceTooShort);
      return;
    }
    setBusy(id);
    setNotice(null);
    setRefused([]);
    try {
      if (what === 'submit') {
        await api.reviewSubmit(id);
        setNotice(c.admin.review.sentToReview);
      } else if (what === 'publish') {
        await api.reviewPublish(id);
        setNotice(c.admin.review.published2);
      } else {
        await api.reviewBounce(id, note.trim());
        setNotice(c.admin.review.bounced2);
      }
      setNote('');
      await load();
    } catch (error) {
      /*
       * The gate's own reasons, not "try again".
       *
       * A publish refused by `GATE_BLOCKED` will be refused identically every
       * time — trying again is the one thing that cannot help. The endpoint
       * returns every blocker at once for exactly this, and throwing them away
       * to show a generic failure is worse than showing nothing: it sends
       * somebody to press the button a second time.
       */
      const blockers =
        error instanceof ApiError && error.code === 'GATE_BLOCKED'
          ? ((error.body as { blockers?: string[] } | null)?.blockers ?? [])
          : [];
      if (blockers.length > 0) {
        setRefused(blockers);
        setNotice(c.admin.review.cannotPublish);
      } else {
        setNotice(c.admin.review.couldNotAct);
      }
    } finally {
      setBusy(null);
    }
  };

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.admin.review.working}</p>;
  }
  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body">{phase.message}</p>
        <button type="button" className="btn-ghost" onClick={() => void load()}>
          {c.common.tryAgain}
        </button>
      </div>
    );
  }

  const { queue, item } = phase;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">{c.admin.review.title}</h1>
        <p className="text-body text-ink-2">{c.admin.review.intro}</p>
      </header>

      {notice ? (
        <div className="flex flex-col gap-1" aria-live="polite">
          <p className="text-body">{notice}</p>
          {refused.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {refused.map((blocker) => (
                <li key={blocker} className="text-caption text-pending">
                  {blocker}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/*
        Four counts, not a bar. They do not partition anything a bar could
        claim to total — a question is in exactly one of these, but "all the
        questions" is not a quantity anybody is asking about. DESIGN.md: a
        figure that is not a sum does not get the treatment that implies one.
      */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatedFigure
          label={c.admin.review.draft}
          value={String(queue.counts.draft)}
          derivation={c.admin.review.countsFrom}
        />
        <StatedFigure
          label={c.admin.review.inReview}
          value={String(queue.counts.inReview)}
          derivation={c.admin.review.countsFrom}
        />
        <StatedFigure
          label={c.admin.review.published}
          value={String(queue.counts.published)}
          derivation={c.admin.review.countsFrom}
        />
        <StatedFigure
          label={c.admin.review.retired}
          value={String(queue.counts.retired)}
          derivation={c.admin.review.countsFrom}
        />
      </div>

      {item ? (
        <Waiting item={item} busy={busy} note={note} onNote={setNote} onAct={act} onSaved={load} />
      ) : (
        <p className="text-body text-ink-2">{c.admin.review.nothingWaiting}</p>
      )}

      <h2 className="text-title mt-2">{c.admin.review.draft}</h2>

      {queue.drafts.length === 0 ? (
        <p className="text-body text-ink-2">{c.admin.review.noDrafts}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {queue.drafts.map((draft) => (
            <Card key={draft.id} as="section" className="flex flex-col gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-caption text-ink-2 num">{draft.stableId}</span>
                <Chip>{draft.field}</Chip>
                <Chip>{draft.topic}</Chip>
                {draft.importFlags.map((flag) => (
                  <Chip key={flag} tone="pending">
                    {flag}
                  </Chip>
                ))}
              </span>

              <p className="text-body">{draft.stem}</p>

              {/*
                The gate's own words, not a summary of them. "3 things to fix"
                sends somebody looking; the list tells them where.
              */}
              {draft.blockers.length === 0 ? (
                <span className="text-correct text-caption inline-flex items-center gap-1.5">
                  <Icon name="check" size={14} strokeWidth={2.5} />
                  {c.admin.review.ready}
                </span>
              ) : (
                <span className="flex flex-col gap-1">
                  <span className="text-pending text-caption inline-flex items-center gap-1.5">
                    <Icon name="clock" size={14} />
                    {c.admin.review.notReady(draft.blockers.length)}
                  </span>
                  <ul className="flex flex-col gap-0.5">
                    {draft.blockers.map((blocker) => (
                      <li key={blocker} className="text-caption text-ink-2">
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </span>
              )}

              <button
                type="button"
                className="btn-ghost"
                disabled={busy === draft.id}
                onClick={() => void act('submit', draft.id)}
              >
                {busy === draft.id ? c.admin.review.sending : c.admin.review.sendToReview}
              </button>
            </Card>
          ))}

          {/* Never implies it showed everything. A capped list that does not say
              so is a list somebody reads as a total. */}
          {queue.more > 0 ? (
            <p className="text-caption text-ink-2 num text-center">
              {c.admin.review.andMore(queue.more)}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * The one question waiting on a reviewer, in full.
 *
 * Everything a decision needs on one screen and nothing behind a tap: the stem,
 * every option with its rationale, the concept line, the working, and what a
 * previous reviewer asked for if it has been round before.
 */
function Waiting({
  item,
  busy,
  note,
  onNote,
  onAct,
  onSaved,
}: {
  item: ReviewItem;
  busy: string | null;
  note: string;
  onNote: (value: string) => void;
  onAct: (what: 'submit' | 'publish' | 'bounce', id: string) => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const c = copy();
  const answer = item.answerView;

  return (
    <Card as="section" className="flex flex-col gap-3 p-5">
      <span className="flex flex-wrap items-center gap-2">
        <Chip tone="pending">{c.admin.review.reviewing}</Chip>
        <span className="text-caption text-ink-2 num">{item.stableId}</span>
        <Chip>{item.field}</Chip>
        <Chip>{item.topic}</Chip>
        {!item.topicWeighted ? <Chip tone="wrong">{c.admin.review.topicUnweighted}</Chip> : null}
      </span>

      <p className="text-stem">{answer.stem}</p>

      {/*
        The editor rather than a read-only rendering of the same fields.
        Everything the gate can refuse is here as something a reviewer can
        change — `PATCH /admin/review/:id` is the only path from an imported row
        to a publishable question, and a screen that displayed the gap without
        offering the field would send somebody back to the spreadsheet.

        Keyed by question id so the form resets between questions: a half-typed
        why-wrong following a reviewer onto the next one is a why-wrong that
        ends up on the wrong question.
      */}
      <QuestionEditor key={item.id} item={item} onSaved={onSaved} />

      {item.bounceNote ? (
        <span className="bg-pending-soft text-pending rounded-control p-3">
          <span className="text-caption uppercase">{c.admin.review.bounced}</span>
          <span className="text-body block">{item.bounceNote}</span>
        </span>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-caption text-ink-2 uppercase">{c.admin.review.bounceLabel}</span>
        <input
          className="field"
          value={note}
          placeholder={c.admin.review.bouncePlaceholder}
          onChange={(e) => onNote(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn-primary"
          disabled={busy !== null}
          onClick={() => void onAct('publish', item.id)}
        >
          {busy !== null ? c.admin.review.publishing : c.admin.review.publish}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy !== null}
          onClick={() => void onAct('bounce', item.id)}
        >
          {busy !== null ? c.admin.review.bouncing : c.admin.review.bounce}
        </button>
      </div>
    </Card>
  );
}
