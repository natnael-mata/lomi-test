/**
 * The exam clock (T-128).
 *
 * **Nothing blinks.** DESIGN.md forbids it and the reason is not taste: a
 * flashing timer in the last minutes of a three-hour exam is a distraction
 * aimed at the person least able to afford one, and it is a migraine and
 * photosensitivity hazard. The state changes by *colour and weight*, once, and
 * then holds.
 */
import { Icon } from './icons';
import {
  formatRemaining,
  formatWithOverrun,
  timerPoliteness,
  timerState,
  type TimerState,
} from './exam-timer';

/** Full class strings — Tailwind cannot see an interpolated one. */
const TIMER_CLASS: Record<TimerState, string> = {
  normal: 'border-border bg-surface text-ink',
  warning: 'border-pending/40 bg-pending-soft text-pending',
  critical: 'border-wrong/40 bg-wrong-soft text-wrong',
};

/**
 * Running over, in practice, is not an error (T-269).
 *
 * The overrun inherited `critical` and rendered in the wrong-answer pair —
 * terracotta on its wash — so a student who took an extra eight seconds on a
 * practice question watched the screen turn the colour it uses to say they got
 * it wrong. Nothing had been submitted.
 *
 * Pencil instead, which is what this palette has for exactly this: "pending is
 * not failure, so it gets no alarm colour". A mock sitting keeps `critical`,
 * because there the clock reaching zero really does end the paper.
 */
const OVERRUN_CLASS = 'border-pending/40 bg-pending-soft text-pending';

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
      // The handoff's clock: bordered, with the clock glyph, in tabular
      // figures. The tint and the colour change together at 20% and 5% left.
      className={`${over ? OVERRUN_CLASS : TIMER_CLASS[state]} rounded-control num inline-flex items-center gap-1.5 border px-3 py-1.5 text-[clamp(15px,2vw,18px)] font-bold`}
      role="timer"
      aria-live={timerPoliteness(state)}
      // "over" rather than "remaining" past zero: a screen reader saying "2:26
      // remaining" when the student is 2:26 over is worse than saying nothing.
      aria-label={
        over
          ? `${formatRemaining(-remainingSec)} over`
          : `${formatRemaining(remainingSec)} remaining`
      }
    >
      <Icon name="clock" size={16} />
      {shown}
    </div>
  );
}
