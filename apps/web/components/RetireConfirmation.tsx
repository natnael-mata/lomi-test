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
import { copy } from '../lib/i18n';

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
        {count === null ? copy().admin.notKnown : count} <span className="text-body">{label}</span>
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
  const c = copy();

  return (
    <Card data-retire-confirmation={stableId}>
      <h2 className="text-title">{c.admin.withdrawTitle(stableId)}</h2>
      <p className="text-body text-ink-2 mt-2">{c.admin.withdrawIntro}</p>

      <ul className="mt-4 flex flex-col gap-3" data-blast-radius="">
        <Line
          count={radius.attempts}
          label={c.admin.attemptsRecorded}
          note={c.admin.attemptsNote}
        />
        <Line
          count={radius.liveSittings}
          label={c.admin.sittingsInProgress}
          note={c.admin.sittingsNote}
        />
        <Line
          count={radius.studentsAffected}
          label={c.admin.readinessFigures}
          note={c.admin.readinessNote}
        />
      </ul>

      <label className="mt-4 flex flex-col gap-1" htmlFor="retire-reason">
        <span className="text-caption text-ink-2">{c.admin.withdrawReasonLabel}</span>
        <input
          id="retire-reason"
          className="field"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder={c.admin.withdrawReasonPlaceholder}
        />
      </label>

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="danger"
          disabled={reason.trim().length === 0}
          blockingReason={reason.trim().length === 0 ? c.admin.sayWhyFirst : undefined}
          onClick={onConfirm}
          data-confirm-retire=""
        >
          {c.admin.withdrawIt}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {c.common.cancel}
        </Button>
      </div>
    </Card>
  );
}
