'use client';

/**
 * Reported posts, and what to do about them (T-197).
 *
 * **The queue existed and had no screen.** `GET /admin/community/reports`,
 * `hide` and `restore` have all been there since the community feature landed;
 * nothing rendered them. So a student could report a post, the report was
 * written to the database, and no operator could ever see it — which is worse
 * than having no report button at all, because the button tells the student
 * their complaint went somewhere.
 *
 * **The post is shown, not linked.** An operator deciding whether to hide
 * something has to read it, and a queue that makes them click through to find
 * out what they are ruling on is a queue that gets rubber-stamped.
 *
 * **Hiding is reversible and says so — and for a while it was not** (T-268).
 * The row carried both buttons, but hiding a post settles its report, and the
 * queue is "reports nobody has looked at yet": the row left the screen at the
 * exact moment Restore became the relevant action. So the undo was rendered
 * only in the one state where nobody needed it, under a caption promising "you
 * can put it back". QA went looking for the way back and found none.
 *
 * Hence the second list. What is currently hidden is a fact about posts, not
 * about reports, so it survives the report being settled and is the honest
 * answer to "what can students not see, and who decided that".
 */
import { useCallback, useEffect, useState } from 'react';

import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Chip } from '../../../components/Chip';
import { api, signInRequired, type HiddenPost, type ReportedPost } from '../../../lib/api';
import { dayAndTime } from '../../../lib/dates';
import { copy } from '../../../lib/i18n';
import { reasonLabel } from '../../../lib/report-reasons';

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; reports: ReportedPost[]; hidden: HiddenPost[] }
  | { kind: 'error'; message: string };

export function ModerationScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      // Both lists together: acting on a post moves it from one to the other,
      // so refreshing only the queue would leave the hidden list stale in
      // exactly the case the operator is watching.
      const [reports, hidden] = await Promise.all([api.moderationQueue(), api.hiddenPosts()]);
      setPhase({ kind: 'ready', reports, hidden });
    } catch (error) {
      if (signInRequired(error)) {
        window.location.assign('/signin');
        return;
      }
      setPhase({ kind: 'error', message: c.admin.moderation.couldNotLoad });
    }
  }, [c.admin.moderation.couldNotLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (postId: string, hide: boolean): Promise<void> => {
    setBusy(postId);
    setNotice(null);
    try {
      await (hide ? api.hidePost(postId) : api.restorePost(postId));
      setNotice(hide ? c.admin.moderation.hidden : c.admin.moderation.restored);
      // Reloaded rather than patched in place: acting on a report marks it
      // reviewed, so the row leaves the queue and the list is the truth.
      await load();
    } catch {
      setNotice(c.admin.moderation.couldNotAct);
    } finally {
      setBusy(null);
    }
  };

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.admin.moderation.loading}</p>;
  }

  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body">{phase.message}</p>
        <Button variant="ghost" className="self-start" onClick={() => void load()}>
          {c.common.tryAgain}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-title">{c.admin.moderation.title}</h1>
          <p className="text-body text-ink-2">{c.admin.moderation.intro}</p>
        </div>
        <Chip tone={phase.reports.length > 0 ? 'pending' : undefined}>
          {c.admin.moderation.waiting(phase.reports.length)}
        </Chip>
      </header>

      {notice ? (
        <p className="text-body" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {phase.reports.length === 0 ? (
        /* Not a congratulation. An empty queue is the ordinary state, and a
           screen that celebrates it reads as though somebody has done
           something. */
        <p className="text-body text-ink-2">{c.admin.moderation.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {phase.reports.map((report) => {
            const hidden = report.post?.hiddenAt !== null && report.post?.hiddenAt !== undefined;
            return (
              <li key={report.id}>
                <Card as="article" className="flex flex-col gap-3" data-report={report.postId}>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* The student's own words for the reason, not the stored
                        enum. `OFF_TOPIC` is a database value that had been
                        showing up on an operator's screen. */}
                    <Chip>{reasonLabel(report.reason, c)}</Chip>
                    {hidden ? <Chip tone="wrong">{c.admin.moderation.isHidden}</Chip> : null}
                    <span className="text-caption text-ink-2 num ml-auto">
                      {dayAndTime(report.createdAt)}
                    </span>
                  </div>

                  {/*
                    Who wrote it and where.

                    A row that is only the post's text asks somebody to rule on
                    a fragment: whether a reply is abuse or a blunt correction
                    can turn on the question it answers.

                    Text, not a link. Threads are opened client-side inside a
                    topic page and have no URL of their own, and staff are
                    scoped to their own programme anyway — a link would be a
                    403 dressed up as a way to read the thread.
                  */}
                  {report.post ? (
                    <p className="text-caption text-ink-2">
                      {c.admin.moderation.context(
                        report.post.authorName,
                        report.post.topicName,
                        report.post.threadTitle,
                      )}
                    </p>
                  ) : null}

                  {/*
                    The post itself, verbatim.

                    `whitespace-pre-wrap` because a student's line breaks are
                    part of what is being judged, and `break-words` because one
                    unbroken string must not widen the console.
                  */}
                  {report.post ? (
                    <p className="text-body bg-surface-2 rounded-card p-3 break-words whitespace-pre-wrap">
                      {report.post.body}
                    </p>
                  ) : (
                    <p className="text-body text-ink-2">{c.admin.moderation.postGone}</p>
                  )}

                  {report.note ? (
                    <p className="text-caption text-ink-2">
                      {c.admin.moderation.reporterSaid(report.note)}
                    </p>
                  ) : null}

                  {report.post ? (
                    <div className="flex flex-wrap gap-2">
                      {hidden ? (
                        <Button
                          variant="ghost"
                          disabled={busy === report.postId}
                          onClick={() => void act(report.postId, false)}
                        >
                          {c.admin.moderation.restore}
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          disabled={busy === report.postId}
                          onClick={() => void act(report.postId, true)}
                        >
                          {c.admin.moderation.hide}
                        </Button>
                      )}
                      {/* Either action settles the report, so the difference
                          worth stating is what happens to the post. */}
                      <p className="text-caption text-ink-2 self-center">
                        {hidden ? c.admin.moderation.restoreWhy : c.admin.moderation.hideWhy}
                      </p>
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Everything currently hidden — the only place Restore can be reached.

        Rendered even when empty, unlike the queue: an operator who has just
        hidden something needs to see where it went, and a section that appears
        only when it is non-empty teaches nobody that it exists.
      */}
      <section className="flex flex-col gap-3">
        <header className="flex flex-col gap-1">
          <h2 className="text-subtitle">{c.admin.moderation.hiddenTitle}</h2>
          <p className="text-caption text-ink-2">{c.admin.moderation.hiddenIntro}</p>
        </header>

        {phase.hidden.length === 0 ? (
          <p className="text-body text-ink-2">{c.admin.moderation.hiddenEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {phase.hidden.map((post) => (
              <li key={post.id}>
                <Card as="article" className="flex flex-col gap-3" data-hidden={post.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="wrong">{c.admin.moderation.isHidden}</Chip>
                    <span className="text-caption text-ink-2 num ml-auto">
                      {dayAndTime(post.hiddenAt)}
                    </span>
                  </div>

                  <p className="text-caption text-ink-2">
                    {c.admin.moderation.context(post.authorName, post.topicName, post.threadTitle)}
                  </p>

                  <p className="text-body bg-surface-2 rounded-card p-3 break-words whitespace-pre-wrap">
                    {post.body}
                  </p>

                  {post.hiddenNote ? (
                    <p className="text-caption text-ink-2">
                      {c.admin.moderation.hiddenNote(post.hiddenNote)}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      disabled={busy === post.id}
                      onClick={() => void act(post.id, false)}
                    >
                      {c.admin.moderation.restore}
                    </Button>
                    <p className="text-caption text-ink-2 self-center">
                      {c.admin.moderation.restoreWhy}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
