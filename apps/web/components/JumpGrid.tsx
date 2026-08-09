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
      <ul className="grid grid-cols-6 gap-2 sm:grid-cols-10">
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
              // ≥44px, per DESIGN.md's touch-target floor. `border-2` on the
              // current cell is a second, non-colour signal alongside the glyph.
              className={[
                'num flex size-11 flex-col items-center justify-center rounded-control text-caption',
                cell.current ? 'border-2 border-brand underline' : 'border border-border',
                cell.flagged
                  ? 'bg-pending-soft text-pending'
                  : cell.answered
                    ? 'bg-brand-soft text-brand'
                    : 'bg-surface text-ink-2',
              ].join(' ')}
            >
              <span aria-hidden="true">{cell.position}</span>
              <span aria-hidden="true" className="leading-none">
                {cell.glyph}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
