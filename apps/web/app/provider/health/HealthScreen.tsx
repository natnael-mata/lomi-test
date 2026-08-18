'use client';

/**
 * The live health board (T-228).
 *
 * **Live means measured now, and the screen has to make that visible.** Every
 * figure comes from a request made a few seconds ago; nothing is cached on
 * either side. So the page carries a countdown to the next check and the time of
 * the last one — a board that silently stops refreshing looks exactly like a
 * board where nothing is wrong, and that is the failure mode worth designing
 * against.
 *
 * **It is deliberately not a metrics dashboard.** No dark chrome, no dense
 * panels of lines, no axes. This is the product's own design system — cards on
 * a tinted ground, semantic colour with an icon and a word beside it, tabular
 * figures — because the person reading it also reads every other screen here,
 * and a second visual language is a second thing to learn at the moment
 * something is broken.
 *
 * The sparkline is the one concession to "show me it moving", and it is honest
 * about its scope: it plots the samples **this page has collected while open**,
 * which is all there is. There is no time-series store behind this and the
 * caption says so rather than implying a history it does not have.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Card } from '../../../components/Card';
import { Icon, type IconName } from '../../../components/icons';
import { api, signInRequired, type ComponentStatus, type HealthReport } from '../../../lib/api';
import { copy } from '../../../lib/i18n';

/** How often the board asks. Short enough to feel live, long enough to be polite. */
const POLL_MS = 5_000;
/** How many samples the sparkline keeps. Roughly a minute at the poll rate. */
const HISTORY = 12;

const STATUS_LOOK: Record<ComponentStatus, { tone: string; fill: string; icon: IconName }> = {
  ok: { tone: 'text-correct', fill: 'bg-correct-soft', icon: 'check' },
  degraded: { tone: 'text-pending', fill: 'bg-pending-soft', icon: 'clock' },
  down: { tone: 'text-wrong', fill: 'bg-wrong-soft', icon: 'cross' },
  // Not a fault, so not a colour. A grey chip is the honest treatment for
  // something nobody has switched on.
  not_configured: { tone: 'text-ink-2', fill: 'bg-surface-2', icon: 'clock' },
};

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; report: HealthReport }
  | { kind: 'error'; message: string };

export function HealthScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(POLL_MS / 1000);
  /** Latency per component, oldest first. Only what this page has seen. */
  const [history, setHistory] = useState<Record<string, number[]>>({});

  const check = useCallback(async (): Promise<void> => {
    try {
      const report = await api.providerHealth();
      setPhase({ kind: 'ready', report });
      setHistory((previous) => {
        const next: Record<string, number[]> = { ...previous };
        for (const component of report.components) {
          if (component.latencyMs === null) continue;
          next[component.key] = [...(next[component.key] ?? []), component.latencyMs].slice(
            -HISTORY,
          );
        }
        return next;
      });
    } catch (error) {
      if (signInRequired(error)) {
        window.location.assign('/signin');
        return;
      }
      setPhase({ kind: 'error', message: c.provider.health.couldNotLoad });
    }
  }, [c.provider.health.couldNotLoad]);

  /**
   * The poll, and the countdown that proves it is still running.
   *
   * One interval driving both, so the number on screen cannot drift away from
   * when the request actually goes out — two timers would eventually disagree,
   * and the one people trust is the one they can see.
   */
  const ticks = useRef(0);
  useEffect(() => {
    void check();
    if (paused) return;
    const timer = setInterval(() => {
      ticks.current += 1;
      const remaining = POLL_MS / 1000 - (ticks.current % (POLL_MS / 1000));
      setCountdown(remaining);
      if (remaining === POLL_MS / 1000) void check();
    }, 1000);
    return () => clearInterval(timer);
  }, [check, paused]);

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.provider.health.working}</p>;
  }
  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body">{phase.message}</p>
        <button type="button" className="btn-ghost" onClick={() => void check()}>
          {c.common.tryAgain}
        </button>
      </div>
    );
  }

  const { report } = phase;
  const overall = STATUS_LOOK[report.overall];
  const headline =
    report.overall === 'down'
      ? c.provider.health.somethingDown
      : report.overall === 'degraded'
        ? c.provider.health.somethingUp
        : c.provider.health.allWell;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-title">{c.provider.health.title}</h1>

          {/* The proof it is live: a pulsing dot, the time of the last check,
              and the countdown to the next. Colour is not carrying any of it —
              the words are. */}
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-caption text-ink-2 num flex items-center gap-2 uppercase">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${paused ? 'bg-ink-2' : 'bg-correct animate-pulse'}`}
              />
              {paused ? c.provider.health.pause : c.provider.health.live}
              <span className="text-ink-2 normal-case">
                · {c.provider.health.lastChecked(clock(report.checkedAt))}
                {paused ? '' : ` · ${c.provider.health.nextIn(countdown)}`}
              </span>
            </span>
            <button
              type="button"
              className="text-caption text-brand rounded-control inline-flex min-h-11 items-center px-2 font-semibold"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? c.provider.health.resume : c.provider.health.pause}
            </button>
          </span>
        </div>

        <span
          data-overall={report.overall}
          className={`${overall.fill} ${overall.tone} rounded-control text-label inline-flex items-center gap-2 self-start p-3`}
        >
          <Icon name={overall.icon} size={18} strokeWidth={2.5} />
          {headline}
        </span>

        <p className="text-caption text-ink-2">{c.provider.health.intro}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {report.components.map((component) => (
          <Card key={component.key} as="section" className="flex flex-col gap-2">
            <span className="flex items-start justify-between gap-3">
              <span className="text-label">{c.provider.health[component.key]}</span>
              <Status status={component.status} />
            </span>

            {component.value ? (
              <span className="text-display num font-display">{component.value}</span>
            ) : null}

            {/* What was measured. Required on every figure — DESIGN.md's rule is
                that a number somebody could check is what makes a board worth
                reading at two in the morning. */}
            <span className="text-caption text-ink-2">{component.derivation}</span>

            <Sparkline samples={history[component.key] ?? []} />

            {component.details.length > 0 ? (
              <span className="mt-1 flex flex-col gap-1">
                {component.details.map((detail) => (
                  <span key={detail.label} className="flex justify-between gap-3">
                    <span className="text-caption text-ink-2">{detail.label}</span>
                    <span className="text-caption num text-right">{detail.value}</span>
                  </span>
                ))}
              </span>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Status({ status }: { status: ComponentStatus }) {
  const c = copy();
  const look = STATUS_LOOK[status];
  const word =
    status === 'ok'
      ? c.provider.health.ok
      : status === 'degraded'
        ? c.provider.health.degraded
        : status === 'down'
          ? c.provider.health.down
          : c.provider.health.notConfigured;
  return (
    <span
      data-status={status}
      className={`${look.fill} ${look.tone} text-caption inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1`}
    >
      <Icon name={look.icon} size={14} strokeWidth={2.5} />
      {word}
    </span>
  );
}

/**
 * Latency, as this page has watched it.
 *
 * **Only the samples collected since the page was opened**, and the caption
 * says so. A chart that looked like history when it is a minute of polling
 * would be the one dishonest thing on a board built to be checkable.
 *
 * Drawn as an inline SVG rather than with a charting library: it is a polyline
 * over at most twelve points, and the route budget is 300 KB.
 */
function Sparkline({ samples }: { samples: readonly number[] }) {
  const c = copy();
  if (samples.length < 2) return null;

  const width = 120;
  const height = 24;
  const max = Math.max(...samples, 1);
  const points = samples
    .map((value, index) => {
      const x = (index / (samples.length - 1)) * width;
      const y = height - (value / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <span className="flex items-center gap-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        // Decoration: the figure above it is the measurement, and the caption
        // beside it says what the line is. Announcing a polyline helps nobody.
        aria-hidden="true"
        className="text-brand shrink-0"
      >
        <polyline
          points={points}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-caption text-ink-2 num">
        {c.provider.health.recent(samples.length)}
      </span>
    </span>
  );
}

/** Wall-clock, to the second. This is the one place seconds matter. */
function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
