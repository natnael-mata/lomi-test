/**
 * The exam clock (T-128).
 *
 * **Nothing blinks.** DESIGN.md forbids it and the reason is not taste: a
 * flashing timer in the last minutes of a three-hour exam is a distraction
 * aimed at the person least able to afford one, and it is a migraine and
 * photosensitivity hazard. The state changes by *colour and weight*, once, and
 * then holds.
 */
import { formatRemaining, timerPoliteness, timerState, type TimerState } from './exam-timer';

/** Full class strings — Tailwind cannot see an interpolated one. */
const TIMER_CLASS: Record<TimerState, string> = {
  normal: 'bg-surface-2 text-ink',
  warning: 'bg-pending-soft text-pending',
  critical: 'bg-wrong-soft text-wrong',
};

export interface ExamTimerProps {
  remainingSec: number;
  durationSec: number;
}

export function ExamTimer({ remainingSec, durationSec }: ExamTimerProps) {
  const state = timerState(remainingSec, durationSec);

  return (
    <div
      data-timer=""
      data-state={state}
      // `num` is tabular figures: without it the digits shuffle sideways every
      // second, which reads as flickering even though nothing is animating.
      className={`${TIMER_CLASS[state]} rounded-control num text-label px-3 py-1.5`}
      role="timer"
      aria-live={timerPoliteness(state)}
      aria-label={`${formatRemaining(remainingSec)} remaining`}
    >
      {formatRemaining(remainingSec)}
    </div>
  );
}
