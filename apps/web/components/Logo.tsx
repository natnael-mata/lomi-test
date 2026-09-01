/**
 * The mark (brand handoff, 2026-09-01).
 *
 * A rounded square in brand fill carrying the lemon, with the wordmark beside
 * it wherever there is room and the square alone where there is not.
 *
 * **It has been three things.** A Ge'ez `ሎሚ` glyph until 2026-08-20 — the only
 * thing in the product requiring Ge'ez coverage, costing every student a 198KB
 * font download on first load. Then the letter `L`, which was honest about
 * being a placeholder: a rounded square with a capital in it is what a product
 * has before it has a logo.
 *
 * Now the lemon the name has always meant. Drawn rather than set in a typeface,
 * which removes the failure that outlasted the Ge'ez one — a mark made of text
 * renders in whatever face the device substitutes, so it is the one element
 * guaranteed to look different on every phone. An SVG is the same shape
 * everywhere.
 *
 * The tile stays. The handoff keeps the lemon on the yellow rounded square in
 * the navigation and drops the fill only when the mark stands alone.
 */
import { LemonMark } from './LemonMark';

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
        className="bg-brand text-on-brand inline-flex shrink-0 items-center justify-center"
        style={{
          width: size,
          height: size,
          // The corner scales with the tile. A fixed 10px is a soft square at
          // 34px and a nearly sharp one at 56.
          borderRadius: Math.max(6, Math.round(size * 0.29)),
        }}
        // The mark is the picture, not text to be read out: the wordmark beside
        // it — or the page title, where there is no wordmark — is what names
        // the product.
        aria-hidden="true"
      >
        {/*
          Unfilled, because the tile is already the fruit. Drawing the body in
          brand yellow on a brand-yellow ground would only thicken its outline.

          0.78 of the tile: the mark's own artwork carries no padding, and the
          handoff's tile has a clear margin around the lemon.
        */}
        <LemonMark size={Math.round(size * 0.78)} filled={false} />
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
