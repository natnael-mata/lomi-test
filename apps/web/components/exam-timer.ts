/**
 * How the exam timer reads as time runs out (T-128).
 *
 * Pure, so the thresholds can be tested without a clock or a DOM.
 */

/** DESIGN.md: the timer changes state at these fractions remaining. */
export const WARNING_AT = 0.2;
export const CRITICAL_AT = 0.05;

export type TimerState = 'normal' | 'warning' | 'critical';

/**
 * The timer's state.
 *
 * Fractions of the sitting, not fixed minute counts: 20% of a three-hour mock is
 * 36 minutes and 20% of a ten-minute drill is two, and both are the point at
 * which a student should start moving. A hardcoded "10 minutes left" would fire
 * before a short sitting had begun.
 */
export function timerState(remainingSec: number, durationSec: number): TimerState {
  if (durationSec <= 0) return 'normal';
  const fraction = Math.max(0, remainingSec) / durationSec;
  if (fraction <= CRITICAL_AT) return 'critical';
  if (fraction <= WARNING_AT) return 'warning';
  return 'normal';
}

/**
 * mm:ss, or h:mm:ss past an hour.
 *
 * Rendered in tabular figures by the component so the digits do not shuffle
 * sideways as they count down — a timer whose width changes every second is
 * read as flickering even when nothing is animating.
 */
export function formatRemaining(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The same clock, but able to run past zero (T-268).
 *
 * **Only practice uses this.** A practice question's limit is advisory — going
 * over costs nothing, which is the decision on record — so the clock stopping
 * dead at 00:00 was the one thing on screen that could not tell the student
 * what was happening. It looked frozen, and the honest number (`over time
 * 2:26 / 1:30`) only appeared after they answered.
 *
 * A mock sitting must NOT use this: there the clock reaching zero ends the
 * paper, so counting upwards would describe time the student does not have.
 */
export function formatWithOverrun(remainingSec: number): string {
  const whole = Math.floor(remainingSec);
  return whole >= 0 ? formatRemaining(whole) : `+${formatRemaining(-whole)}`;
}

/**
 * What a screen reader is told, and how often.
 *
 * A timer that announces every second makes the page unusable with a screen
 * reader on. `aria-live` is set to `off` until the last five minutes, so the
 * announcement arrives when it matters and not before.
 */
export function timerPoliteness(state: TimerState): 'off' | 'polite' {
  return state === 'critical' ? 'polite' : 'off';
}
