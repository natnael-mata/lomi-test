'use client';

/**
 * The way into the community: your own programme's topics (T-195).
 *
 * **There was no index.** `/community/[topicId]` has existed since the feature
 * landed and nothing linked to it, so the only way in was a URL somebody had
 * been given. A discussion surface reachable only by people who already know it
 * exists is one that stays empty.
 *
 * **Scoped to the student's own programme, and that is what makes it safe to
 * put in the navigation.** An Accounting student sees Accounting topics; a
 * Grade 6 student sees Grade 6 topics. Not a moderation control — the server
 * enforces it, and posting into another programme's topic already returns
 * `WRONG_FIELD` — but it is why "a free-text surface spanning Grade 6 to
 * university" was the wrong way to describe this. There is no room where an
 * eleven-year-old and an undergraduate meet.
 *
 * Built from the readiness response rather than a new endpoint: it already
 * carries every topic in the student's track, with the ids, because `/progress`
 * needs exactly the same list.
 */
import { useEffect, useState } from 'react';

import { Card } from '../../components/Card';
import { api, signInRequired, type Readiness } from '../../lib/api';
import { copy } from '../../lib/i18n';

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; readiness: Readiness }
  | { kind: 'nothing' }
  | { kind: 'error' };

export function CommunityIndex() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const fields = await api.myFields();
        const chosen = fields.find((f) => f.chosen);
        if (!chosen) {
          // No programme yet, so no topics to discuss. `/choose` is the fix and
          // the student is sent there rather than shown an empty list.
          window.location.assign('/choose');
          return;
        }
        const readiness = await api.readiness(chosen.id);
        if (!alive) return;
        setPhase(
          readiness.topics.length === 0
            ? { kind: 'nothing' }
            : { kind: 'ready', readiness },
        );
      } catch (e) {
        if (signInRequired(e)) {
          window.location.assign('/signin');
          return;
        }
        if (alive) setPhase({ kind: 'error' });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.community.indexLoading}</p>;
  }
  if (phase.kind === 'error') {
    return <p className="text-body">{c.community.indexFailed}</p>;
  }
  if (phase.kind === 'nothing') {
    return <p className="text-body text-ink-2">{c.community.indexEmpty}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">{c.community.indexTitle}</h1>
        {/* Names the programme, so it is obvious this is not everybody. */}
        <p className="text-body text-ink-2">
          {c.community.indexIntro(phase.readiness.fieldName)}
        </p>
      </header>

      <ul className="grid gap-2 sm:grid-cols-2">
        {phase.readiness.topics.map((topic) => (
          <li key={topic.topicId}>
            <a href={`/community/${topic.topicId}`} className="block">
              <Card className="min-h-11">
                <span className="text-body">{topic.topicName}</span>
              </Card>
            </a>
          </li>
        ))}
      </ul>

      {/* What this is for, once, at the bottom. A student who came here knows
          what a question is; the line is for the one who arrived by accident. */}
      <p className="text-caption text-ink-2">{c.community.indexWhat}</p>
    </div>
  );
}
