/**
 * The exam clock (T-128).
 *
 * **Nothing blinks.** DESIGN.md forbids it and the reason is not taste: a
 * flashing timer in the last minutes of a three-hour exam is a distraction
 * aimed at the person least able to afford one, and it is a migraine and
 * photosensitivity hazard. The state changes by *colour and weight*, once, and
 * then holds.
 */
import {
  formatRemaining,
  formatWithOverrun,
  timerPoliteness,
  timerState,
  type TimerState,
} from './exam-timer';

/** Full class strings — Tailwind cannot see an interpolated one. */
const TIMER_CLASS: Record<TimerState, string> = {
  normal: 'bg-surface-2 text-ink',
  warning: 'bg-pending-soft text-pending',
  critical: 'bg-wrong-soft text-wrong',
};

export interface ExamTimerProps {
  remainingSec: number;
  durationSec: number;
  /**
   * Whether the clock keeps going once it reaches zero (T-268).
   *
   * Off by default, because a mock sitting ends at zero and a clock that
   * carried on counting there would be describing time the student does not
   * have. Practice turns it on: the limit is advisory, so a frozen 00:00 is
   * the one state that tells the student nothing at all.
   */
  countUpPastZero?: boolean;
}

export function ExamTimer({ remainingSec, durationSec, countUpPastZero = false }: ExamTimerProps) {
  const state = timerState(remainingSec, durationSec);
  const shown = countUpPastZero ? formatWithOverrun(remainingSec) : formatRemaining(remainingSec);
  const over = countUpPastZero && remainingSec < 0;

  return (
    <div
      data-timer=""
      data-state={state}
      data-over={over ? '' : undefined}
      // `num` is tabular figures: without it the digits shuffle sideways every
      // second, which reads as flickering even though nothing is animating.
      className={`${TIMER_CLASS[state]} rounded-control num text-label px-3 py-1.5`}
      role="timer"
      aria-live={timerPoliteness(state)}
      // "over" rather than "remaining" past zero: a screen reader saying "2:26
      // remaining" when the student is 2:26 over is worse than saying nothing.
      aria-label={
        over ? `${formatRemaining(-remainingSec)} over` : `${formatRemaining(remainingSec)} remaining`
      }
    >
      {shown}
    </div>
  );
}
