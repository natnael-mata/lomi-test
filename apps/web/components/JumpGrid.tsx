'use client';

/**
 * The question navigator (T-127).
 *
 * Answered, flagged and current are distinguished by **glyph and outline**, not
 * by colour: colour is added on top for the people who can use it, and removed
 * changes nothing about what the grid says.
 */
import { cellsFor, type SlotState } from './jump-grid';
import { copy } from '../lib/i18n';

export interface JumpGridProps {
  slots: SlotState[];
  currentPosition: number;
  onJump: (position: number) => void;
}

export function JumpGrid({ slots, currentPosition, onJump }: JumpGridProps) {
  const cells = cellsFor(slots, currentPosition);

  return (
    <nav aria-label={copy().exam.questionNavigator} data-jump-grid="">
      {/*
        As many 44px columns as fit, not a fixed ten.

        The handoff draws ten small cells to a row in a 340px panel, about 30px
        each. DESIGN.md's floor for a navigator cell is 44px, and it wins:
        this is pressed with a thumb, a hundred times, under a clock. The grid
        fills whatever width it is given with cells that size.
      */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
        {cells.map((cell) => (
          <li key={cell.position}>
            <button
              type="button"
              data-cell={cell.position}
              data-answered={cell.answered ? 'yes' : 'no'}
              data-flagged={cell.flagged ? 'yes' : 'no'}
              data-current={cell.current ? 'yes' : 'no'}
              aria-current={cell.current ? 'true' : undefined}
              aria-label={cell.label}
              onClick={() => onJump(cell.position)}
              className={[
                'num relative flex size-11 w-full items-center justify-center rounded-control text-[13px] font-semibold',
                // Current: an outline AND a weight, never colour alone.
                cell.current
                  ? 'border-link bg-surface text-link border-2'
                  : cell.answered
                    ? 'bg-brand text-on-brand border-2 border-transparent'
                    : 'bg-surface-2 text-ink-2 border-2 border-transparent',
              ].join(' ')}
            >
              <span aria-hidden="true">{cell.position}</span>
              {/* Flagged: a dot in the corner, so a flag survives the answered
                  fill, which is exactly when it is easiest to forget. */}
              {cell.flagged ? (
                <span
                  aria-hidden="true"
                  className="bg-pending absolute top-1 right-1 size-2 rounded-full"
                />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <ul
        aria-hidden="true"
        className="text-ink-3 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-medium"
      >
        <li className="inline-flex items-center gap-1.5">
          <span className="bg-brand size-3 rounded-[3px]" />
          {copy().exam.countAnswered}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="bg-surface-2 border-border size-3 rounded-[3px] border" />
          {copy().exam.countBlank}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="bg-pending size-2 rounded-full" />
          {copy().exam.countFlagged}
        </li>
      </ul>
    </nav>
  );
}
