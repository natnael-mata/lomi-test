'use client';

/**
 * The activity log (T-227).
 *
 * Everything that happened, newest first, in one feed: staff actions,
 * sign-ins and sign-outs, payments, practice, mock exams. A provider's question
 * is *"what has been going on"*, and that question does not come sorted by
 * table.
 *
 * Three things it is careful about, all of them about the people in it:
 *
 * - **Display names, never legal names**, and never an IP. The device column is
 *   "Chrome on Android" because that is what the session row holds — the schema
 *   refuses to store more, and this is the screen that would have leaked it.
 * - **Practice rows say what happened, not how somebody did.** "Answered a
 *   question" rather than a score attached to a named student. PRODUCT.md's
 *   never-shame rule is about what a student is shown; this is a surface where
 *   somebody *else* reads it, which makes the point stronger rather than weaker.
 * - **Staff rows are marked as staff.** The whole value of an audit feed is
 *   telling an operator's action apart from a student's, at a glance, without
 *   reading the sentence.
 *
 * Paged by time rather than by offset. An offset page two of a feed still being
 * written skips whatever arrived in between, which on a record is the one bug
 * that matters.
 */
import { useCallback, useEffect, useState } from 'react';

import { Card } from '../../../components/Card';
import { Chip } from '../../../components/Chip';
import { Icon, type IconName } from '../../../components/icons';
import {
  api,
  refusalMessage,
  signInRequired,
  type ActivityEvent,
  type ActivityPage,
} from '../../../lib/api';
import { copy } from '../../../lib/i18n';
import { dayAndTime } from '../../../lib/dates';

const KIND_ICON: Record<ActivityEvent['kind'], IconName> = {
  staff: 'star',
  signin: 'telegram',
  signout: 'cross',
  payment: 'card',
  practice: 'practise',
  exam: 'mock',
};

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; page: ActivityPage; events: ActivityEvent[] }
  | { kind: 'error'; message: string };

export function ActivityScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [filter, setFilter] = useState<ActivityEvent['kind'] | null>(null);
  const [more, setMore] = useState(false);

  const load = useCallback(
    async (kind: ActivityEvent['kind'] | null): Promise<void> => {
      setPhase({ kind: 'loading' });
      try {
        const page = await api.activity(kind ? [kind] : []);
        setPhase({ kind: 'ready', page, events: page.events });
      } catch (error) {
        if (signInRequired(error)) {
          window.location.assign('/signin');
          return;
        }
        setPhase({
          kind: 'error',
          message: refusalMessage(error) ?? c.provider.activity.couldNotLoad,
        });
      }
    },
    [c.provider.activity.couldNotLoad],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  /** The next page, appended. The cursor is the oldest event already shown. */
  const older = async (): Promise<void> => {
    if (phase.kind !== 'ready' || !phase.page.nextCursor) return;
    setMore(true);
    try {
      const next = await api.activity(filter ? [filter] : [], phase.page.nextCursor);
      setPhase({ kind: 'ready', page: next, events: [...phase.events, ...next.events] });
    } catch {
      // Keep what is already on screen. Losing a page that loaded because the
      // next one did not is the wrong trade on a record.
    } finally {
      setMore(false);
    }
  };

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.provider.activity.working}</p>;
  }
  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body">{phase.message}</p>
        <button type="button" className="btn-ghost" onClick={() => void load(filter)}>
          {c.common.tryAgain}
        </button>
      </div>
    );
  }

  const FILTERS: [ActivityEvent['kind'] | null, string][] = [
    [null, c.provider.activity.all],
    ['staff', c.provider.activity.kindStaff],
    ['signin', c.provider.activity.kindSignin],
    ['signout', c.provider.activity.kindSignout],
    ['payment', c.provider.activity.kindPayment],
    ['practice', c.provider.activity.kindPractice],
    ['exam', c.provider.activity.kindExam],
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">{c.provider.activity.title}</h1>
        <p className="text-body text-ink-2">{c.provider.activity.intro}</p>
      </header>

      <nav aria-label={c.provider.activity.title} className="flex flex-wrap gap-2">
        {FILTERS.map(([kind, label]) => {
          const on = filter === kind;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(kind)}
              className={[
                'text-caption inline-flex min-h-11 items-center rounded-full px-3.5',
                // The word is already the whole control, so the state is carried
                // by fill and weight rather than by colour alone.
                on ? 'bg-brand-soft text-brand font-semibold' : 'bg-surface-2 text-ink-2',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* Where the numbers came from, stated. This feed merges five sources and
          caps each one; saying so is the difference between "60 events" and
          "60 events out of what". */}
      <p className="text-caption text-ink-2 num">
        {c.provider.activity.counted(phase.events.length)} ·{' '}
        {c.provider.activity.scanned(
          phase.page.totals.staff,
          phase.page.totals.signins,
          phase.page.totals.payments,
          phase.page.totals.attempts,
        )}
      </p>

      {phase.events.length === 0 ? (
        <p className="text-body text-ink-2">{c.provider.activity.empty}</p>
      ) : (
        <Card as="section" className="flex flex-col px-4 py-1">
          {phase.events.map((event, index) => (
            <span
              key={event.id}
              data-event={event.kind}
              className={[
                'flex items-start gap-3 py-3',
                index === phase.events.length - 1 ? '' : 'border-border border-b',
              ].join(' ')}
            >
              <span className="bg-surface-2 text-ink-2 mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full">
                <Icon name={KIND_ICON[event.kind]} size={16} />
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-label">{event.who}</span>
                  {event.staff ? <Chip tone="brand">{c.provider.activity.staffTag}</Chip> : null}
                </span>
                <span className="text-body text-ink-2">{event.what}</span>
                {event.reference ? (
                  <span className="text-caption text-ink-2 num break-all">{event.reference}</span>
                ) : null}
              </span>

              <span className="text-caption text-ink-2 num shrink-0 text-right">
                {dayAndTime(event.at)}
              </span>
            </span>
          ))}
        </Card>
      )}

      {phase.page.nextCursor ? (
        <button type="button" className="btn-ghost" disabled={more} onClick={() => void older()}>
          {more ? c.provider.activity.loadingMore : c.provider.activity.more}
        </button>
      ) : phase.events.length > 0 ? (
        <p className="text-caption text-ink-2 text-center">{c.provider.activity.end}</p>
      ) : null}
    </div>
  );
}
