/**
 * The live sum on the weight editor (T-162a).
 *
 * Reads out the total and, when it is wrong, **how far wrong**. A reviewer
 * balancing a field is doing arithmetic in their head; the screen's job is to
 * do it for them and say what is left, not to tell them something is amiss.
 *
 * Pending rather than wrong for an unbalanced sum: nothing is broken, the work
 * is unfinished. Red is for a student's answer being incorrect, and reusing it
 * here would blur the one meaning the palette carries everywhere else.
 */
import { Chip } from './Chip';
import { weightSum, type WeightRow } from './weight-sum';

export function WeightSumIndicator({ rows }: { rows: WeightRow[] }) {
  const sum = weightSum(rows);
  const balanced = sum.state === 'balanced';

  return (
    <div
      className="flex items-center justify-between gap-3"
      data-weight-sum={sum.state}
      data-total={sum.total}
    >
      <p className={`text-label num ${balanced ? 'text-correct' : 'text-pending'}`}>
        {sum.message}
      </p>
      <Chip tone={balanced ? 'correct' : 'pending'} data-sum-chip="">
        {balanced ? 'Balanced' : `${sum.differencePct}% ${sum.state}`}
      </Chip>
    </div>
  );
}
