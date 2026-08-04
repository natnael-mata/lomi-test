import { describe, expect, it } from 'vitest';

import {
  CRITICAL_AT,
  formatRemaining,
  timerPoliteness,
  timerState,
  WARNING_AT,
} from './exam-timer';

const THREE_HOURS = 10_800;

describe('timerState (T-128)', () => {
  it('is normal for most of the sitting', () => {
    expect(timerState(THREE_HOURS, THREE_HOURS)).toBe('normal');
    expect(timerState(THREE_HOURS * 0.5, THREE_HOURS)).toBe('normal');
    expect(timerState(THREE_HOURS * 0.21, THREE_HOURS)).toBe('normal');
  });

  it('warns at a fifth remaining', () => {
    expect(timerState(THREE_HOURS * WARNING_AT, THREE_HOURS)).toBe('warning');
    expect(timerState(THREE_HOURS * 0.1, THREE_HOURS)).toBe('warning');
  });

  it('turns critical at a twentieth', () => {
    expect(timerState(THREE_HOURS * CRITICAL_AT, THREE_HOURS)).toBe('critical');
    expect(timerState(60, THREE_HOURS)).toBe('critical');
    expect(timerState(0, THREE_HOURS)).toBe('critical');
  });

  /**
   * Fractions, not fixed minutes. 20% of a three-hour mock is 36 minutes and 20%
   * of a ten-minute drill is two; a hardcoded "10 minutes left" would fire
   * before a short sitting had even begun.
   */
  it('scales with the sitting rather than using fixed minutes', () => {
    expect(timerState(120, 600)).toBe('warning');
    expect(timerState(2160, THREE_HOURS)).toBe('warning');
    // Ten minutes left is a warning in a three-hour paper (5.5%) and the whole
    // sitting in a ten-minute one.
    expect(timerState(600, THREE_HOURS)).toBe('warning');
    expect(timerState(600, 600)).toBe('normal');
    // Five minutes of three hours is 2.8% — critical.
    expect(timerState(300, THREE_HOURS)).toBe('critical');
  });

  it('never goes below normal on a nonsense duration', () => {
    expect(timerState(100, 0)).toBe('normal');
    expect(timerState(-50, THREE_HOURS)).toBe('critical');
  });
});

describe('formatRemaining', () => {
  it('is mm:ss under an hour', () => {
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(59)).toBe('00:59');
    expect(formatRemaining(600)).toBe('10:00');
    expect(formatRemaining(3599)).toBe('59:59');
  });

  it('adds hours past one', () => {
    expect(formatRemaining(3600)).toBe('1:00:00');
    expect(formatRemaining(THREE_HOURS)).toBe('3:00:00');
  });

  // A timer whose width changes every second reads as flickering even when
  // nothing is animating.
  it('keeps a fixed width within each band', () => {
    expect(formatRemaining(9)).toHaveLength(5);
    expect(formatRemaining(599)).toHaveLength(5);
  });

  it('never renders a negative', () => {
    expect(formatRemaining(-1)).toBe('00:00');
  });
});

describe('timerPoliteness', () => {
  // A timer announcing every second makes the page unusable with a screen
  // reader on.
  it('stays silent until the last stretch', () => {
    expect(timerPoliteness('normal')).toBe('off');
    expect(timerPoliteness('warning')).toBe('off');
    expect(timerPoliteness('critical')).toBe('polite');
  });
});
