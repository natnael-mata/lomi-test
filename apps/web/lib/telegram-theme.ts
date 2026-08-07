/**
 * Adopting Telegram's host theme (T-176, T-177, T-178), with no browser involved.
 *
 * Inside a Mini App, Telegram hands the page the colours of whatever theme the
 * student has chosen. Ignoring them makes the app look like a website someone
 * embedded; taking all of them makes it unreadable, because those colours were
 * chosen against Telegram's own type and never against ours.
 *
 * Three rules, in order of how much damage getting them wrong does:
 *
 * 1. **Only chrome is adoptable.** The allowlist below covers ground, surface,
 *    text, hint and the button pair. **Semantic colours are never in it** — a
 *    host theme cannot repaint correct, wrong, pending or reward. Those carry
 *    meaning a student learns in one session and relies on in the next, and a
 *    theme that turned "wrong" into the brand colour would be teaching them
 *    something false about their own answers (T-177).
 *
 * 2. **A pair reverts as a unit.** Contrast is a property of two colours, and
 *    our tokens are the only combination already audited (T-099). Reverting just
 *    the failing side leaves an untested hybrid — their background under our
 *    ink, which nobody has ever checked. So if any pair in a group fails 4.5:1,
 *    the whole group goes back to ours (T-178).
 *
 * 3. **Anything unparseable is simply not adopted.** These values come from a
 *    host we do not control. "Not a colour I can read" is an ordinary answer,
 *    not an error to surface at a student mid-exam.
 */
import { meetsAA } from './contrast';

/** The subset of Telegram's `themeParams` this app will look at. */
export interface TelegramThemeParams {
  bg_color?: string | undefined;
  secondary_bg_color?: string | undefined;
  text_color?: string | undefined;
  hint_color?: string | undefined;
  button_color?: string | undefined;
  button_text_color?: string | undefined;
}

/** Our tokens, as the fallback for anything not adopted. */
export interface ThemeFallbacks {
  bg: string;
  surface: string;
  ink: string;
  ink2: string;
  brand: string;
  onBrand: string;
}

/**
 * A set of variables that stand or fall together, with the pairs proving it.
 *
 * Grouped by what is actually read against what, rather than one variable at a
 * time — see rule 2. `reading` is the group that decides whether the app looks
 * like Telegram at all; the other two are independent of it, so a host with an
 * unreadable button colour still gets its own background.
 */
export type ThemeGroup = 'reading' | 'hint' | 'button';

export interface AdoptedTheme {
  /** CSS custom properties to set on the root, already contrast-checked. */
  vars: Record<string, string>;
  /** Which groups were taken from the host. Useful in a test and in a log. */
  adopted: ThemeGroup[];
  /** Groups offered by the host but rejected, with why. */
  rejected: { group: ThemeGroup; reason: 'unreadable' | 'incomplete' }[];
}

/**
 * Works out which of the host's colours are safe to use.
 *
 * Returns every variable, adopted or not, so a caller sets one complete theme
 * rather than a patch over whatever was there before — a partial application is
 * how a student ends up with yesterday's background under today's text.
 */
export function adoptTelegramTheme(
  params: TelegramThemeParams,
  fallbacks: ThemeFallbacks,
): AdoptedTheme {
  const vars: Record<string, string> = {
    '--color-bg': fallbacks.bg,
    '--color-surface': fallbacks.surface,
    '--color-ink': fallbacks.ink,
    '--color-ink-2': fallbacks.ink2,
    '--color-brand': fallbacks.brand,
    '--color-on-brand': fallbacks.onBrand,
  };
  const adopted: ThemeGroup[] = [];
  const rejected: AdoptedTheme['rejected'] = [];

  // --- reading: ground, surface and the text on both -------------------------
  const bg = params.bg_color;
  const surface = params.secondary_bg_color;
  const ink = params.text_color;
  if (bg && surface && ink) {
    if (meetsAA(ink, bg) && meetsAA(ink, surface)) {
      vars['--color-bg'] = bg;
      vars['--color-surface'] = surface;
      vars['--color-ink'] = ink;
      adopted.push('reading');
    } else {
      rejected.push({ group: 'reading', reason: 'unreadable' });
    }
  } else if (bg || surface || ink) {
    // Partial is refused rather than mixed. Their background with our ink is a
    // pair nobody has audited, and it is exactly the combination that looks
    // fine on the reviewer's phone and fails on a student's.
    rejected.push({ group: 'reading', reason: 'incomplete' });
  }

  // --- hint: secondary text, read against whichever ground won ---------------
  const hint = params.hint_color;
  if (hint) {
    if (meetsAA(hint, vars['--color-bg']!) && meetsAA(hint, vars['--color-surface']!)) {
      vars['--color-ink-2'] = hint;
      adopted.push('hint');
    } else {
      rejected.push({ group: 'hint', reason: 'unreadable' });
    }
  }

  // --- button: the primary action's fill and its label -----------------------
  const button = params.button_color;
  const buttonText = params.button_text_color;
  if (button && buttonText) {
    if (meetsAA(buttonText, button)) {
      vars['--color-brand'] = button;
      vars['--color-on-brand'] = buttonText;
      adopted.push('button');
    } else {
      rejected.push({ group: 'button', reason: 'unreadable' });
    }
  } else if (button || buttonText) {
    rejected.push({ group: 'button', reason: 'incomplete' });
  }

  return { vars, adopted, rejected };
}

/**
 * The tokens a host theme may never touch.
 *
 * Exported so a test can assert the allowlist and this list stay disjoint. The
 * rule is easy to break by adding one convenient mapping, and the damage is
 * invisible until a student is told an answer was "correct" in a colour that
 * means something else everywhere else in the app.
 */
export const NEVER_ADOPTED = [
  '--color-correct',
  '--color-correct-soft',
  '--color-wrong',
  '--color-wrong-soft',
  '--color-pending',
  '--color-pending-soft',
  '--color-reward',
  '--color-reward-fill',
  '--color-on-reward',
] as const;

/** Every variable `adoptTelegramTheme` is allowed to write. */
export const ADOPTABLE_VARS = [
  '--color-bg',
  '--color-surface',
  '--color-ink',
  '--color-ink-2',
  '--color-brand',
  '--color-on-brand',
] as const;
