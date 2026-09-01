/**
 * The lemon, drawn (T-269).
 *
 * The geometry lives in `lemon-mark.mjs` because the app icons and the favicon
 * are rasterised from the same paths by a Node script with no build step. This
 * file is only the React face of it.
 *
 * **Ink is `currentColor`.** Inside the nav tile the mark inherits
 * `text-on-brand`; on cream it inherits the surrounding ink. One fewer colour
 * to keep in step, and it means the mark cannot end up the wrong green on a
 * surface somebody adds later.
 *
 * The mint and the cream come from the theme's custom properties with the
 * literal as a fallback, so a token change reaches the mark without an edit
 * here — and the mark still draws if it is ever rendered outside the app's
 * stylesheet, which is exactly what the icon script does.
 */
import {
  BODY,
  BODY_TILT,
  CHECK,
  CHECK_INK_WIDTH,
  CHECK_MINT_WIDTH,
  GLINT,
  LEAF_LEFT,
  LEAF_RIGHT,
  LEAVES_MIN_PX,
  MARK_COLORS,
  NUB_LEFT,
  NUB_RIGHT,
  STEM,
} from './lemon-mark.mjs';

const MINT = `var(--color-correct-soft, ${MARK_COLORS.mint})`;
const CREAM = `var(--color-surface, ${MARK_COLORS.cream})`;
const LEMON = `var(--color-brand, ${MARK_COLORS.lemon})`;

export interface LemonMarkProps {
  size?: number | undefined;
  /**
   * Draw the leaves.
   *
   * Defaults to the design's own rule — off below 24px, where two 3px leaves
   * are four grey pixels and a suggestion, while the fruit and the check still
   * read.
   */
  leaves?: boolean | undefined;
  /**
   * Fill the body with brand yellow.
   *
   * Off inside the nav tile: the tile already is the fruit, and a second yellow
   * on top of it only thickens the outline.
   */
  filled?: boolean | undefined;
  className?: string | undefined;
}

export function LemonMark({ size = 24, leaves, filled = true, className }: LemonMarkProps) {
  const withLeaves = leaves ?? size >= LEAVES_MIN_PX;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      /*
       * Decoration, unconditionally — the same rule `icons.tsx` states. The
       * wordmark beside it, or the page title where there is none, is what
       * names the product; a mark with its own accessible name would be a mark
       * that had become the label.
       */
      aria-hidden="true"
    >
      <g transform={BODY_TILT}>
        <path d={NUB_RIGHT} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        <path d={NUB_LEFT} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        <ellipse
          cx={BODY.cx}
          cy={BODY.cy}
          rx={BODY.rx}
          ry={BODY.ry}
          fill={filled ? LEMON : 'none'}
          stroke="currentColor"
          strokeWidth={1.5}
        />
        <path d={GLINT} stroke={CREAM} strokeWidth={1.3} strokeLinecap="round" />
      </g>

      {withLeaves ? (
        <>
          <path
            d={LEAF_LEFT}
            fill={MINT}
            stroke="currentColor"
            strokeWidth={1.35}
            strokeLinejoin="round"
          />
          <path
            d={LEAF_RIGHT}
            fill={MINT}
            stroke="currentColor"
            strokeWidth={1.35}
            strokeLinejoin="round"
          />
          <path d={STEM} stroke="currentColor" strokeWidth={1.45} strokeLinecap="round" />
        </>
      ) : null}

      {/*
        Last, so it sits over the fruit rather than under the glint — and twice,
        ink then mint. Mint alone is 1.2:1 on the yellow tile and the check
        disappears into the fruit; the ink underlay is what keeps it a check at
        every size and on every ground.
      */}
      <path
        d={CHECK}
        stroke="currentColor"
        strokeWidth={CHECK_INK_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={CHECK}
        stroke={MINT}
        strokeWidth={CHECK_MINT_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
