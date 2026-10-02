'use client';

/**
 * The six-digit code, drawn as six boxes (redesign handoff, § Verify).
 *
 * **One real input underneath, not six.** Six separate fields is the usual way
 * to build this and it is the way that breaks: pasting a code fills one box,
 * `autocomplete="one-time-code"` has nothing single to attach to, a backspace
 * at the start of box four has to be choreographed by hand, and a screen reader
 * announces six unlabelled text fields. Every one of those is a student who has
 * the code in their hand and cannot get it into the form.
 *
 * So there is exactly one `<input>`, holding the whole string, carrying the
 * label and the autocomplete — the same field the flow always had. It is laid
 * transparently over the boxes, which are presentation. Android's SMS autofill,
 * iOS's keyboard suggestion, paste, and a password manager all keep working
 * because the thing they are looking at has not changed.
 *
 * The boxes are `aria-hidden` for the same reason: the input already announces
 * its own value, and six spans reading "4", "8", "2" after it is the value said
 * twice.
 */
import { useId } from 'react';

const LENGTH = 6;

export interface CodeInputProps {
  label: string;
  hint?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
}

export function CodeInput({ label, hint, value, onChange, disabled }: CodeInputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');
  // Which box the caret is in. One past the last digit, and the last box once
  // the code is complete — so a full code does not leave the ring floating in
  // empty space past the end.
  const active = Math.min(value.length, LENGTH - 1);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-ink text-[14px] font-semibold">
        {label}
      </label>

      <div className="relative">
        <div aria-hidden="true" className="grid grid-cols-6 gap-2">
          {digits.map((digit, i) => (
            <span
              key={i}
              className={[
                'font-display rounded-control grid h-[58px] place-items-center border text-[26px] font-bold',
                digit || (!disabled && i === active)
                  ? 'border-link bg-brand-soft border-2'
                  : 'border-border-input bg-surface',
              ].join(' ')}
            >
              {digit}
            </span>
          ))}
        </div>

        {/*
          The real field, over the top of them.

          `opacity-0` rather than `sr-only` or `hidden`: it has to stay the size
          of the boxes so a tap anywhere on the row focuses it, and it has to
          stay a rendered, focusable input so the on-screen keyboard opens and
          the browser offers the SMS code above it. `text-transparent` and a
          transparent caret belong to the same idea — the value is drawn behind
          it, and the real glyphs sitting on top would be the code twice.

          `peer` is what lets the focus ring go on the boxes instead, below.
        */}
        <input
          id={id}
          className="peer absolute inset-0 h-full w-full cursor-pointer bg-transparent text-transparent caret-transparent opacity-0 outline-none"
          value={value}
          disabled={disabled ?? false}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, LENGTH))}
        />

        {/*
          The ring the input is no longer able to draw for itself.

          An invisible field shows an invisible focus ring, and this is the one
          screen where a keyboard user has nothing else to go on. Drawn as a
          sibling over the boxes, driven by `peer-focus-visible` so it follows
          the real field's focus exactly rather than guessing at it.

          Ink and 2px, which is the global ring — the brand measures 1.2:1 on
          white and the whole reason the stylesheet's `:focus-visible` is ink.
          Copied here rather than inherited because the element wearing the ring
          is not the element being focused.
        */}
        <div
          aria-hidden="true"
          className="peer-focus-visible:outline-ink pointer-events-none absolute -inset-1 rounded-[12px] outline-2 outline-offset-0 outline-transparent"
        />
      </div>

      {hint ? (
        <p id={hintId} className="text-ink-2 text-[13px]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
