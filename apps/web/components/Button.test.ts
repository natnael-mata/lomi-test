import { describe, expect, it } from 'vitest';

import { buttonClasses, buttonLabel, type ButtonVariant } from './Button';

describe('buttonClasses (T-092)', () => {
  it('maps each variant to its design-system class', () => {
    expect(buttonClasses('primary')).toBe('btn-primary');
    expect(buttonClasses('ghost')).toBe('btn-ghost');
    expect(buttonClasses('danger')).toBe('btn-danger');
  });

  it('defaults to primary', () => {
    expect(buttonClasses()).toBe('btn-primary');
  });

  it('appends a caller class without dropping the variant', () => {
    expect(buttonClasses('ghost', 'mt-4')).toBe('btn-ghost mt-4');
  });

  it('emits no stray whitespace when no class is given', () => {
    expect(buttonClasses('primary', undefined)).toBe('btn-primary');
    expect(buttonClasses('primary', '')).toBe('btn-primary');
  });

  // Disabled is a state, not a variant: a `variant="disabled"` would look dead
  // while staying fully clickable and operative to a screen reader.
  it('has no disabled variant', () => {
    const variants: ButtonVariant[] = ['primary', 'ghost', 'danger'];
    expect(variants).toHaveLength(3);
    // @ts-expect-error — 'disabled' is not a variant, and must not become one.
    expect(() => buttonClasses('disabled')).not.toThrow();
  });
});

describe('buttonLabel (T-093)', () => {
  it('shows the blocking reason instead of the label when disabled', () => {
    expect(buttonLabel('Publish', true, "Can't publish · 3 blockers")).toBe(
      "Can't publish · 3 blockers",
    );
  });

  it('shows the label when there is no reason', () => {
    expect(buttonLabel('Publish', true, undefined)).toBe('Publish');
  });

  // A reason on an available action reads as an explanation of why it is not
  // available, which is the opposite of true.
  it('ignores a reason on an enabled button', () => {
    expect(buttonLabel('Publish', false, '2 why-wrongs missing')).toBe('Publish');
    expect(buttonLabel('Publish', undefined, '2 why-wrongs missing')).toBe('Publish');
  });

  it('treats an empty reason as no reason', () => {
    expect(buttonLabel('Publish', true, '')).toBe('Publish');
  });
});
