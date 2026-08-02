'use client';

/**
 * One answer choice (T-094).
 *
 * The rule DESIGN.md states and this component exists to keep: `data-state`
 * **mirrors** `aria-checked`. The state drives the colours and `aria-checked`
 * drives what a screen reader says, and if they are set independently they drift
 * — a row painted as selected that announces itself unselected, or worse, the
 * reverse. Here both are derived from one value, so drift is not expressible.
 */
import type { KeyboardEvent } from 'react';

export type OptionState = 'default' | 'selected' | 'correct' | 'wrong';

export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];

/**
 * What `aria-checked` says for a given state.
 *
 * `correct` and `wrong` are post-answer states: `wrong` is the row the student
 * actually chose, so it stays checked; `correct` is the right answer, which they
 * may or may not have picked — the reviewed state carries that separately, and
 * announcing it as "checked" would tell a student they chose it when they did
 * not.
 */
export function ariaCheckedFor(state: OptionState, wasChosen: boolean): boolean {
  if (state === 'selected' || state === 'wrong') return true;
  if (state === 'correct') return wasChosen;
  return false;
}

/** The word shown beside a resolved option, or null while unanswered. */
export function verdictWordFor(state: OptionState, wasChosen: boolean): string | null {
  if (state === 'correct') return 'Correct';
  if (state === 'wrong' && wasChosen) return 'Yours';
  return null;
}

export interface AnswerOptionProps {
  label: OptionLabel;
  text: string;
  // `| undefined` explicitly, because `exactOptionalPropertyTypes` is on: with
  // it, `state?: OptionState` means "may be absent", NOT "may be undefined", and
  // forwarding an absent prop from a parent is a type error. Spelling it out is
  // the honest fix; loosening the compiler flag would hide the next one.
  state?: OptionState | undefined;
  /** Whether this is the row the student picked. Drives "Yours" and aria-checked. */
  wasChosen?: boolean | undefined;
  disabled?: boolean | undefined;
  onSelect?: ((label: OptionLabel) => void) | undefined;
  /** Arrow-key navigation within the group; supplied by `<AnswerOptionGroup>`. */
  onNavigate?: ((direction: -1 | 1) => void) | undefined;
  /**
   * Whether this row is the group's single tab stop.
   *
   * Decided by the GROUP, not here. An option cannot know whether any of its
   * siblings is checked, and a rule computed per-option ("checked, or else the
   * first one") gives two tab stops the moment anything but A is selected —
   * which is exactly the roving tabindex failing to rove.
   */
  isTabStop?: boolean | undefined;
}

export function AnswerOption({
  label,
  text,
  state = 'default',
  wasChosen = false,
  disabled = false,
  onSelect,
  onNavigate,
  isTabStop = false,
}: AnswerOptionProps) {
  const checked = ariaCheckedFor(state, wasChosen);
  const verdict = verdictWordFor(state, wasChosen);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!onNavigate) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      onNavigate(1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      onNavigate(-1);
    }
  };

  return (
    <button
      type="button"
      // `radio`, not `checkbox`: exactly one answer is possible, and the role is
      // what tells a screen reader that choosing one clears the others.
      role="radio"
      aria-checked={checked}
      data-state={state}
      data-label={label}
      className="option"
      disabled={disabled}
      onClick={() => onSelect?.(label)}
      onKeyDown={handleKeyDown}
      // Roving tabindex: the group is one tab stop and the arrows move within
      // it. Four separate tab stops per question is four times the keystrokes on
      // every question in a 100-question mock.
      tabIndex={isTabStop ? 0 : -1}
    >
      <span className="option-key" aria-hidden="true">
        {label}
      </span>
      <span className="flex-1 text-left">{text}</span>
      {verdict !== null && <span className="text-caption shrink-0">{verdict}</span>}
    </button>
  );
}
