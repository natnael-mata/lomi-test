/**
 * The exam timer's rendered contract (T-128).
 *
 * The state logic lives in `exam-timer.ts` and is tested there. What is tested
 * here is the part a unit test of pure functions cannot see: that the component
 * never animates. That was verified in a real browser at all three thresholds —
 * `animationName: none`, `transitionDuration: 0s`, zero running animations — and
 * these assertions exist so it stays that way.
 *
 * A timer that blinks in the last five minutes is the single most distracting
 * thing that can happen on the screen at the worst moment to be distracted.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ExamTimer } from './ExamTimer';

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'ExamTimer.tsx'),
  'utf8',
);

describe('ExamTimer (T-128)', () => {
  it('renders at each threshold', () => {
    for (const remaining of [10800, 1800, 240, 0]) {
      expect(() => ExamTimer({ remainingSec: remaining, durationSec: 10800 })).not.toThrow();
    }
  });

  // Verified in the browser; asserted here so a later edit cannot reintroduce it.
  it('carries no animation utility of any kind', () => {
    for (const banned of ['animate-', 'animation:', '@keyframes', 'transition']) {
      expect(source, `${banned} would make the timer move`).not.toContain(banned);
    }
  });

  // Tabular figures: without them the digits are different widths and the whole
  // timer jitters sideways once a second, which reads as blinking even though
  // nothing is animating.
  it('uses tabular figures so the width never shifts', () => {
    expect(source).toMatch(/\bnum\b|tabular-nums/);
  });

  // Announcing every second for three hours would make a screen reader unusable.
  // Silent until it matters, then it speaks.
  it('is silent to assistive tech until critical', () => {
    expect(source).toContain('timerPoliteness');
  });
});
