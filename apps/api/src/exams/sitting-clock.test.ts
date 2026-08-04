import { describe, expect, it } from 'vitest';

import {
  acceptsAnswer,
  clockFor,
  closeReasonFor,
  deadlineFor,
  remainingSec,
  sittingState,
  SUBMIT_GRACE_SEC,
} from './sitting-clock';

const START = new Date('2026-08-04T09:00:00.000Z');
const THREE_HOURS = 10_800;
const ENDS = new Date('2026-08-04T12:00:00.000Z');

const sitting = (closedAt: Date | null = null) => ({ startedAt: START, endsAt: ENDS, closedAt });
const at = (iso: string) => new Date(iso);

describe('deadlineFor (T-121)', () => {
  it('is the start plus the duration', () => {
    expect(deadlineFor(START, THREE_HOURS)).toEqual(ENDS);
  });

  /**
   * The bug this prevents: `startedAt` written by the database as
   * `CURRENT_TIMESTAMP` while `endsAt` is computed in Node. Every DateTime here
   * is `TIMESTAMP(3)` without a time zone, so a Postgres session on
   * Africa/Addis_Ababa would stamp the start three hours from the deadline and
   * the sitting would expire the instant it began.
   */
  it('is instant arithmetic — the same wherever the machine thinks it is', () => {
    // Two instants that are the same moment expressed in different offsets.
    const utc = new Date('2026-08-04T09:00:00.000Z');
    const addis = new Date('2026-08-04T12:00:00.000+03:00');
    expect(utc.getTime()).toBe(addis.getTime());
    expect(deadlineFor(utc, THREE_HOURS).getTime()).toBe(deadlineFor(addis, THREE_HOURS).getTime());
  });

  it('crosses a day boundary without special-casing it', () => {
    const late = new Date('2026-08-04T23:30:00.000Z');
    expect(deadlineFor(late, THREE_HOURS).toISOString()).toBe('2026-08-05T02:30:00.000Z');
  });
});

describe('remainingSec (T-122)', () => {
  it('counts down', () => {
    expect(remainingSec(ENDS, at('2026-08-04T09:00:00.000Z'))).toBe(THREE_HOURS);
    expect(remainingSec(ENDS, at('2026-08-04T11:59:00.000Z'))).toBe(60);
  });

  // A negative reaches a UI that renders it: "-7 minutes remaining".
  it('never goes negative', () => {
    expect(remainingSec(ENDS, at('2026-08-04T12:00:01.000Z'))).toBe(0);
    expect(remainingSec(ENDS, at('2026-08-05T00:00:00.000Z'))).toBe(0);
  });

  it('is zero exactly at the deadline', () => {
    expect(remainingSec(ENDS, ENDS)).toBe(0);
  });
});

describe('sittingState', () => {
  it('is open until the deadline', () => {
    expect(sittingState(sitting(), at('2026-08-04T11:59:59.000Z'))).toBe('open');
    expect(sittingState(sitting(), ENDS)).toBe('open');
  });

  // Not "open forever because nothing ran to say otherwise".
  it('is expired once the time has passed but the row has not settled', () => {
    expect(sittingState(sitting(), at('2026-08-04T12:00:01.000Z'))).toBe('expired');
  });

  it('is closed once the row has settled, whatever the clock says', () => {
    const closed = sitting(at('2026-08-04T10:00:00.000Z'));
    expect(sittingState(closed, at('2026-08-04T10:30:00.000Z'))).toBe('closed');
    expect(sittingState(closed, at('2026-08-05T00:00:00.000Z'))).toBe('closed');
  });
});

describe('acceptsAnswer — the grace period (T-123)', () => {
  it('accepts inside the deadline', () => {
    expect(acceptsAnswer(sitting(), at('2026-08-04T11:59:59.000Z'))).toBe(true);
  });

  // The student pressed the button inside the limit; the packet arrived after.
  it('accepts one second late', () => {
    expect(acceptsAnswer(sitting(), at('2026-08-04T12:00:01.000Z'))).toBe(true);
  });

  it('accepts right up to the grace boundary', () => {
    const edge = new Date(ENDS.getTime() + SUBMIT_GRACE_SEC * 1000);
    expect(acceptsAnswer(sitting(), edge)).toBe(true);
  });

  it('refuses past it', () => {
    const past = new Date(ENDS.getTime() + (SUBMIT_GRACE_SEC + 1) * 1000);
    expect(acceptsAnswer(sitting(), past)).toBe(false);
  });

  // Grace is for the network, not for a second run at the paper.
  it('refuses once the sitting has closed, however early', () => {
    const closed = sitting(at('2026-08-04T10:00:00.000Z'));
    expect(acceptsAnswer(closed, at('2026-08-04T10:00:01.000Z'))).toBe(false);
  });

  it('is small enough not to be usable as thinking time', () => {
    // A twelfth of the smallest per-question budget.
    expect(SUBMIT_GRACE_SEC).toBeLessThanOrEqual(60 / 12);
  });
});

describe('closeReasonFor', () => {
  it('is SUBMITTED when the student closed it in time', () => {
    expect(closeReasonFor(sitting(), at('2026-08-04T11:30:00.000Z'))).toBe('SUBMITTED');
  });

  // A sitting that ran out at 12:00 and settled three days later must not read
  // as "submitted three days later".
  it('is EXPIRED when the time had already gone', () => {
    expect(closeReasonFor(sitting(), at('2026-08-04T12:00:01.000Z'))).toBe('EXPIRED');
    expect(closeReasonFor(sitting(), at('2026-08-07T12:00:00.000Z'))).toBe('EXPIRED');
  });

  // The graced answer lands in a sitting that is closing as EXPIRED.
  it('is EXPIRED inside the grace window', () => {
    expect(closeReasonFor(sitting(), at('2026-08-04T12:00:03.000Z'))).toBe('EXPIRED');
  });
});

describe('clockFor', () => {
  it('carries the server’s own now, so a client can measure its skew', () => {
    const now = at('2026-08-04T10:00:00.000Z');
    const clock = clockFor(sitting(), THREE_HOURS, now);
    expect(clock).toEqual({
      serverNow: '2026-08-04T10:00:00.000Z',
      endsAt: '2026-08-04T12:00:00.000Z',
      durationSec: THREE_HOURS,
      remainingSec: 7200,
      state: 'open',
    });
  });

  it('reports zero remaining rather than a negative, once past', () => {
    const clock = clockFor(sitting(), THREE_HOURS, at('2026-08-04T13:00:00.000Z'));
    expect(clock.remainingSec).toBe(0);
    expect(clock.state).toBe('expired');
  });
});

describe('the clock uses no local-time method', () => {
  // The guard for the rule the file's header states. `getHours` and friends
  // silently make a deadline depend on where the server thinks it is.
  it('never calls a local-time method', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    const { dirname, resolve } = await import('node:path');
    // Walk up from the working directory rather than using `import.meta`: this
    // workspace compiles as CommonJS for Nest's decorator metadata, and
    // `import.meta` is a syntax error under that module setting even though
    // Vitest would run it happily — a gap only `npm run typecheck` catches.
    let dir = process.cwd();
    let found = '';
    for (let i = 0; i < 6 && !found; i++) {
      const candidate = resolve(dir, 'apps/api/src/exams/sitting-clock.ts');
      if (existsSync(candidate)) found = candidate;
      else if (existsSync(resolve(dir, 'src/exams/sitting-clock.ts'))) {
        found = resolve(dir, 'src/exams/sitting-clock.ts');
      }
      dir = dirname(dir);
    }
    expect(found, 'could not locate sitting-clock.ts').not.toBe('');
    const source = readFileSync(found, 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const banned of ['setHours', 'getHours', 'getDate', 'toLocale', 'getTimezoneOffset']) {
      expect(code, `${banned} makes the deadline depend on the server's time zone`).not.toContain(
        banned,
      );
    }
  });
});
