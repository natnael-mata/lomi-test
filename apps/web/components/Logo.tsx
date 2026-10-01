/**
 * The mark and the wordmark (redesign handoff, 2026-10-01).
 *
 * **The tile is gone.** Every previous mark was a letter or a glyph inside a
 * rounded yellow square, because each needed a ground to sit on — a Ge'ez `ሎሚ`
 * until 2026-08-20, then the letter `L`, then a whole lemon with a check
 * through it. A slice needs none: it is already a circle, already yellow, and
 * already the shape of the thing it names, so a square behind it was a box
 * around a picture of a lemon.
 *
 * **The wordmark is two-tone.** "Lomi" in ink and "-Exams" in the muted grey,
 * because the product is Lomi and the rest says which Lomi — that is the
 * handoff's reading and it survives being set small, where a single-weight
 * wordmark turns into one long word.
 */
import { LemonMark } from './LemonMark';

export interface LogoProps {
  /** 34px in the rail and the admin bar; 44–56px on the sign-in screen. */
  size?: number | undefined;
  /** The Latin wordmark beside the glyph. Dropped where the rail is compact. */
  wordmark?: boolean | undefined;
  /**
   * Set on an `ink-deep` band — the hero and the footer.
   *
   * Not a dark mode: this product has one theme, and those bands are dark
   * *surfaces* on a light page. What they need is the other pair of inks, because
   * `ink` is 1.1:1 and the muted `ink-3` is 3.4:1 on near-black. A prop rather
   * than a `className` override so the two halves of the wordmark cannot be
   * recoloured one at a time, which is how a half-grey logo ships.
   */
  onDark?: boolean | undefined;
  className?: string | undefined;
}

export function Logo({ size = 34, wordmark = false, onDark = false, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      {/* No tile. The slice is its own shape — see the note above. */}
      <LemonMark size={size} className="shrink-0" />
      {wordmark ? (
        <span
          className={`font-display text-[20px] font-extrabold -tracking-[0.01em] ${
            onDark ? 'text-on-deep' : ''
          }`}
        >
          {NAME}
          {/* The half that says which Lomi, one step down from the other. */}
          <span className={onDark ? 'text-on-deep-3' : 'text-ink-3'}>{SUFFIX}</span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * Not from the dictionary, deliberately: a brand name is the one string that
 * must read identically in every locale (T-201, D1). Translating it would give
 * the product two names.
 */
const NAME = 'Lomi';

/** The half that says which Lomi. Set in the muted ink beside it. */
const SUFFIX = '-Exams';
