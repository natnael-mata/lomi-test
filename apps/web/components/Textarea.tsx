'use client';

/**
 * A labelled multi-line field (T-268).
 *
 * **The community's question body was a single-line `<input>`.** Somebody
 * describing what confused them about a question writes two or three sentences,
 * and a one-line field scrolls sideways as they type — so the beginning of what
 * they wrote disappears while they are still writing it, and they cannot read
 * back the thing they are about to post. The most common piece of writing in the
 * product was in the field least able to hold it.
 *
 * Everything else is `Input`'s contract, deliberately: a visible caption label
 * above (never a placeholder), `aria-invalid` only when true, and an error that
 * supersedes the hint. Two fields that behave differently under a screen reader
 * because one of them is taller would be its own bug.
 */
import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  /** Always visible, always above the field. Not optional, by design. */
  label: ReactNode;
  /** Names what is wrong and what to do. Presence marks the field invalid. */
  error?: string | undefined;
  /** Standing guidance shown under the field when there is no error. */
  hint?: string | undefined;
}

export function Textarea({ label, error, hint, className, rows = 4, ...rest }: TextareaProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const invalid = Boolean(error);

  const describedBy = invalid ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-ink-2 uppercase">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        // `field` is the shared control style; the height comes from `rows` and
        // the min-height is dropped so a four-row box is not forced to 52px.
        className={['field h-auto py-3', className].filter(Boolean).join(' ')}
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
