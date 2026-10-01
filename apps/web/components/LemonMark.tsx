/**
 * The lemon slice, drawn (T-270).
 *
 * The geometry lives in `lemon-mark.mjs` because the app icons and the favicon
 * are rasterised from the same paths by a Node script with no build step. This
 * file is only the React face of it.
 *
 * **Every colour is the mark's own, not the interface's.** Unlike the previous
 * mark — which took `currentColor` so it inherited ink from whatever sat around
 * it — a lemon slice is three specific colours in a fixed relationship, and
 * inheriting any of them would turn it into a monochrome disc. They come from
 * the theme's custom properties with the literal as a fallback, so a token
 * change reaches the mark and the mark still draws when rendered outside the
 * app's stylesheet, which is exactly what the icon script does.
 */
import {
  CENTER_R,
  FLESH_R,
  MARK_COLORS,
  PITH_R,
  RIND_R,
  WEDGES,
  WEDGE_STROKE,
} from './lemon-mark.mjs';

const RIND = `var(--color-brand-hover, ${MARK_COLORS.rind})`;
const PITH = `var(--color-brand-pale, ${MARK_COLORS.pith})`;
const FLESH = `var(--color-brand, ${MARK_COLORS.flesh})`;

/** Below this the centre dot is one pixel, so it is dropped. */
export const CENTER_DOT_MIN_PX = 24;

export interface LemonMarkProps {
  size?: number | undefined;
  /**
   * Draw the pith dot at the centre.
   *
   * Defaults to size — at 20px square the dot is about one device pixel and
   * reads as a smudge where the four wedges meet, rather than as the detail it
   * is at 34px and above.
   */
  centerDot?: boolean | undefined;
  className?: string | undefined;
}

export function LemonMark({ size = 24, centerDot, className }: LemonMarkProps) {
  const withDot = centerDot ?? size >= CENTER_DOT_MIN_PX;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-100 -100 200 200"
      className={className}
      /*
       * Decoration, unconditionally — the same rule `icons.tsx` states. The
       * wordmark beside it, or the page title where there is none, is what
       * names the product; a mark with its own accessible name would be a mark
       * that had become the label.
       */
      aria-hidden="true"
    >
      <circle r={RIND_R} fill={RIND} />
      <circle r={PITH_R} fill={PITH} />
      {/* One path for all four wedges, so the pith between them is a single
          stroke and meets cleanly at the centre. */}
      <path
        d={WEDGES}
        fill={FLESH}
        stroke={PITH}
        strokeWidth={WEDGE_STROKE}
        strokeLinejoin="round"
      />
      {withDot ? <circle r={CENTER_R} fill={PITH} /> : null}
    </svg>
  );
}

/** Exported so the icon script and the tests agree on the flesh radius. */
export { FLESH_R };
