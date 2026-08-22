/**
 * The mark (design handoff, § Assets).
 *
 * A rounded square in brand fill carrying a single letter, with the wordmark
 * beside it wherever there is room and the square alone where there is not.
 *
 * **It was a Ge'ez glyph until 2026-08-20.** The handoff read *"34px rounded
 * square, brand fill, 'ሎሚ' glyph in Noto Sans Ethiopic"*, and that glyph was the
 * only thing in the product requiring Ge'ez coverage — it cost every student a
 * 198KB font download on first load. With the move to English only the mark is
 * Latin and the font is gone.
 *
 * `font-mark` explicitly rather than inheriting, which still matters: the mark
 * is the one element that must look identical on every device, and an inherited
 * stack is how it ends up substituted differently on each of them.
 */
export interface LogoProps {
  /** 34px in the rail and the admin bar; 44–56px on the sign-in screen. */
  size?: number | undefined;
  /** The Latin wordmark beside the glyph. Dropped where the rail is compact. */
  wordmark?: boolean | undefined;
  className?: string | undefined;
}

export function Logo({ size = 34, wordmark = false, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <span
        className="bg-brand text-on-brand font-mark inline-flex shrink-0 items-center justify-center rounded-[10px]"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
        // The glyph is the picture, not text to be read out: the wordmark
        // beside it — or the page title, where there is no wordmark — is what
        // names the product.
        aria-hidden="true"
      >
        L
      </span>
      {wordmark ? (
        <span className="font-display text-[18px] font-bold -tracking-[0.02em]">{NAME}</span>
      ) : null}
    </span>
  );
}

/**
 * Not from the dictionary, deliberately: a brand name is the one string that
 * must read identically in every locale (T-201, D1). Translating it would give
 * the product two names.
 */
const NAME = 'Lomi-Exams';
