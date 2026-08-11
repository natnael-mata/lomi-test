'use client';

/**
 * Asking about a topic (T-195, T-196, T-197).
 *
 * One topic, its questions, and a box to ask another. The thread list and the
 * thread itself are the same screen: on a low-end phone a second route is a
 * second load, and a student who is stuck wants the answer, not navigation.
 *
 * **The verified badge is the reason this screen exists.** A thread of guesses is
 * worse than no thread at all when somebody is revising — so a reviewer's reply
 * is marked, and the mark says what it means rather than being a mystery tick.
 */
import { useCallback, useEffect, useState } from 'react';

import { Card } from '../../../components/Card';
import { Chip } from '../../../components/Chip';
import { Input } from '../../../components/Input';
import { ApiError, api, type ThreadSummary, type ThreadView } from '../../../lib/api';
import { copy } from '../../../lib/i18n';

type Phase =
  | { kind: 'loading' }
  | { kind: 'list'; threads: ThreadSummary[] }
  | { kind: 'thread'; thread: ThreadView }
  | { kind: 'error'; message: string };

const REASONS = ['WRONG', 'ABUSIVE', 'SPAM', 'OFF_TOPIC'] as const;

export function CommunityScreen({ topicId }: { topicId: string }) {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<string | null>(null);

  const fail = useCallback(
    (error: unknown): void => {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          setFieldError(c.community.tooFast);
          return;
        }
        if (error.code === 'FIELD_REQUIRED') {
          setPhase({ kind: 'error', message: c.community.chooseProgramme });
          return;
        }
        if (error.code === 'BODY_REQUIRED' || error.code === 'TITLE_REQUIRED') {
          // The server's wording, not ours — it already names the fix, and two
          // copies of a message are two chances to disagree.
          setFieldError(error.message);
          return;
        }
      }
      setPhase({ kind: 'error', message: c.community.couldNotLoad });
    },
    [c.community],
  );

  const loadList = useCallback(async (): Promise<void> => {
    try {
      setPhase({ kind: 'list', threads: await api.threads(topicId) });
    } catch (error) {
      fail(error);
    }
  }, [fail, topicId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openThread = useCallback(
    async (threadId: string): Promise<void> => {
      try {
        setPhase({ kind: 'thread', thread: await api.thread(threadId) });
        setReplyBody('');
        setFieldError(null);
      } catch (error) {
        fail(error);
      }
    },
    [fail],
  );

  const ask = useCallback(async (): Promise<void> => {
    setFieldError(null);
    setBusy(true);
    try {
      const { id } = await api.openThread(topicId, title, body);
      setTitle('');
      setBody('');
      await openThread(id);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }, [body, fail, openThread, title, topicId]);

  const sendReply = useCallback(async (): Promise<void> => {
    if (phase.kind !== 'thread') return;
    setFieldError(null);
    setBusy(true);
    try {
      await api.reply(phase.thread.id, replyBody);
      await openThread(phase.thread.id);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }, [fail, openThread, phase, replyBody]);

  const report = useCallback(
    async (postId: string, reason: string): Promise<void> => {
      try {
        await api.reportPost(postId, reason);
        // Says what happens next, not just that it was received. "Reported" on
        // its own leaves somebody wondering whether anything will come of it.
        setReported(postId);
      } catch (error) {
        fail(error);
      }
    },
    [fail],
  );

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.community.working}</p>;
  }
  if (phase.kind === 'error') {
    return <p className="text-body">{phase.message}</p>;
  }

  if (phase.kind === 'thread') {
    const { thread } = phase;
    return (
      <div className="flex flex-col gap-4">
        <button type="button" className="btn-ghost self-start" onClick={() => void loadList()}>
          {c.common.back}
        </button>

        <Card as="article" className="flex flex-col gap-2">
          <h1 className="text-title">{thread.title}</h1>
          <p className="text-body">{thread.body}</p>
          <span className="text-caption text-ink-2">{thread.authorName}</span>
        </Card>

        <ul className="flex flex-col gap-2">
          {thread.posts.map((post) => (
            <li key={post.id} className="bg-surface-2 rounded-card flex flex-col gap-1.5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-caption text-ink-2">{post.authorName}</span>
                {/*
                  The badge, and what it means beside it. A tick nobody can
                  interpret is decoration; "Reviewer" plus the explanation is a
                  reason to trust this reply over the three above it (T-196).
                */}
                {post.verified ? (
                  <Chip tone="correct" title={c.community.verifiedMeans}>
                    {c.community.verified}
                  </Chip>
                ) : null}
                {post.isYours ? <Chip tone="brand">{c.community.yours}</Chip> : null}
              </div>

              <p className="text-body">{post.body}</p>

              {/* Only the author reaches this, and only for their own post —
                  somebody whose reply vanished without a word assumes it was
                  censored, and they are halfway right (T-197). */}
              {post.hidden ? <p className="text-caption text-wrong">{c.community.hidden}</p> : null}

              {!post.isYours && !post.hidden ? (
                reported === post.id ? (
                  <p className="text-caption text-ink-2">{c.community.reported}</p>
                ) : (
                  <details>
                    <summary className="text-caption text-ink-2">{c.community.report}</summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          className="btn-ghost"
                          onClick={() => void report(post.id, reason)}
                        >
                          {reason === 'WRONG'
                            ? c.community.reportWrong
                            : reason === 'ABUSIVE'
                              ? c.community.reportAbusive
                              : reason === 'SPAM'
                                ? c.community.reportSpam
                                : c.community.reportOffTopic}
                        </button>
                      ))}
                    </div>
                  </details>
                )
              ) : null}
            </li>
          ))}
        </ul>

        <Input
          label={c.community.reply}
          error={fieldError ?? undefined}
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder={c.community.replyPlaceholder}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={() => void sendReply()}
          disabled={busy}
        >
          {busy ? c.community.asking : c.community.reply}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">{c.community.title}</h1>

      {phase.threads.length === 0 ? (
        <p className="text-body text-ink-2">{c.community.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {phase.threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                className="bg-surface-2 rounded-card flex w-full flex-col gap-1 p-3 text-left"
                onClick={() => void openThread(thread.id)}
              >
                <span className="text-body">{thread.title}</span>
                <span className="text-caption text-ink-2">
                  {c.community.replies(thread.replies)} · {thread.authorName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Card as="section" className="flex flex-col gap-3">
        <Input
          label={c.community.askTitle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          label={c.community.askBody}
          error={fieldError ?? undefined}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="button" className="btn-primary" onClick={() => void ask()} disabled={busy}>
          {busy ? c.community.asking : c.community.ask}
        </button>
      </Card>
    </div>
  );
}
