'use client';

/**
 * A labelled text input (T-095).
 *
 * DESIGN.md: surface fill, 12px radius, 52px, **a visible caption label above —
 * never a placeholder standing in for a label**. A placeholder disappears the
 * moment someone types, so a student who looks away mid-form has no way back to
 * what the field was for; it is also invisible to a screen reader as a label and
 * fails contrast at almost every implementation.
 *
 * Errors set `aria-invalid`, point at the message with `aria-describedby`, and
 * the message names the cause **and** the fix. "Invalid phone" tells somebody
 * they are wrong and leaves them there.
 */
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Always visible, always above the field. Not optional, by design. */
  label: ReactNode;
  /** Names what is wrong and what to do. Presence marks the field invalid. */
  error?: string | undefined;
  /** Standing guidance shown under the field when there is no error. */
  hint?: string | undefined;
}

export function Input({ label, error, hint, className, ...rest }: InputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const invalid = Boolean(error);

  // The error wins: two messages under one field is one message too many, and
  // the hint is standing guidance the error has just superseded.
  const describedBy = invalid ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-ink-2 uppercase">
        {label}
      </label>
      <input
        id={id}
        className={['field', className].filter(Boolean).join(' ')}
        // `aria-invalid` only when true. `aria-invalid="false"` on every field
        // is noise a screen reader reads out for no reason.
        {...(invalid ? { 'aria-invalid': true } : {})}
        {...(describedBy ? { 'aria-describedby': describedBy } : {})}
        {...rest}
      />
      {invalid ? (
        <p id={errorId} className="text-caption text-wrong" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
