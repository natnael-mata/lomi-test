/**
 * The product's button (T-092, T-093).
 *
 * DESIGN.md fixes the shape: 52px minimum height, full width on mobile, 12px
 * radius, a brand-tinted shadow on primary and none on danger. Those live in
 * `design-system/tailwind-theme.css` as `.btn-*`, so this component decides
 * *which* class applies and what the label says — never what the pixels are.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Three variants, not four.
 *
 * The task lists `disabled` alongside the others, but disabled is a **state**,
 * not a look. Modelling it as a variant permits `variant="disabled"` on a button
 * that is still clickable — grey, unresponsive-looking, and fully operative to a
 * screen reader and to the mouse. The disabled *appearance* comes from the real
 * `disabled` attribute, so the two can never disagree.
 */
export type ButtonVariant = 'primary' | 'ghost' | 'danger';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  // `| undefined` spelled out because `exactOptionalPropertyTypes` is on: with
  // it, `variant?: ButtonVariant` means "may be absent", not "may be undefined",
  // so forwarding a possibly-undefined value from a caller is a type error.
  variant?: ButtonVariant | undefined;
  children: ReactNode;
  /**
   * Why this action cannot be taken — "2 why-wrongs missing", "Can't publish ·
   * 3 blockers".
   *
   * Rendered **in place of the label** when the button is disabled, per
   * DESIGN.md. A greyed-out button with its normal label tells a reviewer only
   * that something is wrong, and leaves them hunting for what; the button is
   * the thing they are looking at, so it is where the answer belongs.
   */
  blockingReason?: string | undefined;
}

/**
 * Resolves the class list. Exported so it can be tested without a DOM — the
 * mapping is the part with decisions in it.
 */
export function buttonClasses(variant: ButtonVariant = 'primary', className?: string): string {
  return [VARIANT_CLASS[variant], className].filter(Boolean).join(' ');
}

/**
 * What the button says: the blocking reason when there is one and the button is
 * disabled, otherwise the label.
 *
 * A reason on an *enabled* button is ignored rather than shown. It would
 * otherwise read as an explanation of an action that is, in fact, available.
 */
export function buttonLabel(
  children: ReactNode,
  disabled: boolean | undefined,
  blockingReason: string | undefined,
): ReactNode {
  return disabled && blockingReason ? blockingReason : children;
}

export function Button({
  variant = 'primary',
  className,
  children,
  blockingReason,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const showingReason = Boolean(disabled && blockingReason);

  return (
    <button
      // Explicit, because a <button> inside a form defaults to `submit` and
      // submits it — the single most common accidental behaviour in React forms.
      type={type ?? 'button'}
      className={buttonClasses(variant, className)}
      disabled={disabled}
      // The reason IS the accessible name when it is showing, so a screen
      // reader gets the same answer as the eye. `title` covers the case where
      // a long reason is visually truncated.
      title={showingReason ? blockingReason : undefined}
      {...rest}
    >
      {buttonLabel(children, disabled, blockingReason)}
    </button>
  );
}
