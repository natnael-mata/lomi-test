'use client';

/**
 * The four answer choices as one radio group (T-094).
 *
 * A group rather than four loose buttons because a radio group is one tab stop
 * with arrow keys inside it. Four separate stops is four times the keystrokes on
 * every question, and a 100-question mock makes that difference felt.
 */
import { useRef } from 'react';

import { AnswerOption, ariaCheckedFor, type OptionLabel, type OptionState } from './AnswerOption';

export interface AnswerChoice {
  label: OptionLabel;
  text: string;
  state?: OptionState | undefined;
  wasChosen?: boolean | undefined;
}

export interface AnswerOptionGroupProps {
  choices: AnswerChoice[];
  /** The question, as the group's accessible name. */
  ariaLabel: string;
  disabled?: boolean | undefined;
  onSelect?: ((label: OptionLabel) => void) | undefined;
}

/**
 * Which row is the group's single tab stop.
 *
 * The checked row if there is one, otherwise the first. Computed here because it
 * is a property of the GROUP: an option asking "am I checked, or am I A?" gives
 * two tab stops as soon as B, C or D is selected, and a keyboard user then tabs
 * into the middle of a question they have already answered.
 */
export function tabStopIndex(choices: readonly AnswerChoice[]): number {
  const checked = choices.findIndex((c) =>
    ariaCheckedFor(c.state ?? 'default', c.wasChosen ?? false),
  );
  return checked === -1 ? 0 : checked;
}

export function AnswerOptionGroup({
  choices,
  ariaLabel,
  disabled = false,
  onSelect,
}: AnswerOptionGroupProps) {
  const container = useRef<HTMLDivElement>(null);
  const activeIndex = tabStopIndex(choices);

  /**
   * Moves focus by one, wrapping.
   *
   * Wrapping because the list is four items long and always fully visible:
   * stopping at the end makes a student press Down twice to discover nothing
   * happens, which reads as the page being broken rather than as a boundary.
   */
  const navigate = (from: number, direction: -1 | 1): void => {
    const buttons = container.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    if (!buttons || buttons.length === 0) return;
    const next = (from + direction + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div ref={container} role="radiogroup" aria-label={ariaLabel} className="flex flex-col gap-2">
      {choices.map((choice, index) => (
        <AnswerOption
          key={choice.label}
          label={choice.label}
          text={choice.text}
          state={choice.state}
          wasChosen={choice.wasChosen}
          disabled={disabled}
          onSelect={onSelect}
          onNavigate={(direction) => navigate(index, direction)}
          isTabStop={index === activeIndex}
        />
      ))}
    </div>
  );
}
