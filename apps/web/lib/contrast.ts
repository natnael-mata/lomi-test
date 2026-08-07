/**
 * WCAG relative luminance and contrast ratio.
 *
 * Extracted from `components/contrast.test.ts`, which audits the design tokens
 * (T-099), because T-178 needs the same maths at **runtime**: Telegram hands the
 * Mini App a host theme, and a param that cannot be read against our text has to
 * be rejected before it reaches the page.
 *
 * One implementation, so the check that guards the tokens and the check that
 * guards a host's colours can never disagree about what 4.5:1 means.
 */

/** WCAG 2.1 AA for body text. Not relaxed for large text: this is read on a cheap phone in daylight. */
export const AA_BODY = 4.5;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Parses `#abc`, `#aabbcc` and `#aabbccdd`, or returns `null`.
 *
 * `null` rather than a throw or a default: the inputs include colours from a
 * host app we do not control, so "not a colour I can read" is an ordinary
 * answer. Defaulting to black would silently pass a contrast check against a
 * value nobody supplied.
 */
export function parseHex(value: string): { r: number; g: number; b: number } | null {
  const hex = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  if (full.length !== 6 && full.length !== 8) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function luminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/**
 * The contrast ratio between two colours, or `null` if either is unreadable.
 *
 * `null` propagates rather than collapsing to 0 or 21: a caller deciding whether
 * to trust a host colour needs to tell "fails the check" from "was never a
 * colour", and those want different handling.
 */
export function contrast(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whether a foreground/background pair is legible at AA. Unreadable input is not. */
export function meetsAA(foreground: string, background: string): boolean {
  const ratio = contrast(foreground, background);
  return ratio !== null && ratio >= AA_BODY;
}
