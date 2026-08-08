/**
 * The confirmation before a question is withdrawn (T-165).
 *
 * DESIGN.md: this is the only Danger button and the only modal in the system,
 * and its blast radius is **itemised — never summarised as "this affects many
 * students"**, because a number an operator can check is what makes them stop
 * and read.
 *
 * So the three counts are listed separately and none of them is totalled. They
 * are different kinds of harm: history that stays correct whatever happens next,
 * a student in a timed exam right now, and a readiness figure that was partly
 * built on a question about to be withdrawn. One number would let all three be
 * skimmed past.
 */
import { Button } from './Button';
import { Card } from './Card';

export interface RetireBlastRadius {
  attempts: number | null;
  liveSittings: number | null;
  studentsAffected: number | null;
  measurable: boolean;
}

export interface RetireConfirmationProps {
  stableId: string;
  radius: RetireBlastRadius;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** One line of the itemised radius. Reads as a sentence, not a statistic. */
function Line({ count, label, note }: { count: number | null; label: string; note: string }) {
  return (
    <li className="flex flex-col gap-0.5" data-radius-line={label}>
      <span className="text-label num">
        {/* Null is "not measurable", never zero — reporting 0 would say this
            disturbs nobody, which is a claim the code cannot make. */}
        {count === null ? 'Not known' : count} <span className="text-body">{label}</span>
      </span>
      <span className="text-caption text-ink-2">{note}</span>
    </li>
  );
}

export function RetireConfirmation({
  stableId,
  radius,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
}: RetireConfirmationProps) {
  return (
    <Card data-retire-confirmation={stableId}>
      <h2 className="text-title">Withdraw {stableId}?</h2>
      <p className="text-body text-ink-2 mt-2">
        The question stops being served and stops being sampled into new papers. It is not deleted —
        students&rsquo; history keeps pointing at something real.
      </p>

      <ul className="mt-4 flex flex-col gap-3" data-blast-radius="">
        <Line
          count={radius.attempts}
          label="attempts recorded"
          note="Kept as they are. A past answer stays what it was."
        />
        <Line
          count={radius.liveSittings}
          label="sittings in progress"
          note="Students in a timed exam right now, with this question on their paper."
        />
        <Line
          count={radius.studentsAffected}
          label="students’ readiness figures"
          note="Their readiness rests partly on this question."
        />
      </ul>

      <label className="mt-4 flex flex-col gap-1" htmlFor="retire-reason">
        <span className="text-caption text-ink-2">Why is it being withdrawn?</span>
        <input
          id="retire-reason"
          className="field"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Option B is also correct."
        />
      </label>

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="danger"
          disabled={reason.trim().length === 0}
          blockingReason={reason.trim().length === 0 ? 'Say why first' : undefined}
          onClick={onConfirm}
          data-confirm-retire=""
        >
          Withdraw it
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
