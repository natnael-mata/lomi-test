/**
 * A badge tier (T-192).
 *
 * **The tiers differ by shape, not by colour.** DESIGN.md: "colour never carries
 * meaning alone… badge tiers must differ by *shape* as well as colour so they
 * read in greyscale." That is not a preference — around one man in twelve has
 * some form of colour vision deficiency, and bronze against gold is exactly the
 * pair that collapses. A student who cannot tell which tier they are on has been
 * given a decoration rather than a reward.
 *
 * So each tier has its own polygon, drawn inline as an SVG path: three sides for
 * Bronze, four for Silver, six for Gold, and a star for Platinum. Print the page
 * in black and white and they are still four different things.
 *
 * The tier name is also written out beside it. The shape carries the meaning at a
 * glance; the word settles it — and a screen reader reads the word, which no
 * amount of shape ever helps with.
 */
import type { SVGProps } from 'react';

export type TierId = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

/**
 * One shape per tier, and the sides ascend with the tier.
 *
 * Not an arbitrary set of icons: more sides reads as "further along" without
 * anybody being told, the same way more stars does. A star for the top because
 * it is the one shape that breaks the run, which is what a top tier should do.
 */
const SHAPES: Record<TierId, { path: string; sides: string }> = {
  // A dash. Not an empty box — an absence should look like an absence, not like
  // a tier somebody failed to render.
  NONE: { path: 'M4 12h16', sides: 'no tier yet' },
  BRONZE: { path: 'M12 3 L21 20 L3 20 Z', sides: 'triangle' },
  SILVER: { path: 'M12 3 L21 12 L12 21 L3 12 Z', sides: 'diamond' },
  GOLD: { path: 'M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z', sides: 'hexagon' },
  PLATINUM: {
    path: 'M12 2 L14.6 9.1 L22 9.6 L16.3 14.2 L18.2 21.4 L12 17.3 L5.8 21.4 L7.7 14.2 L2 9.6 L9.4 9.1 Z',
    sides: 'star',
  },
};

const LABELS: Record<TierId, string> = {
  NONE: 'No tier yet',
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
};

/**
 * Colour is the *second* signal, never the only one.
 *
 * `currentColor` on the stroke so the shape inherits the text colour and stays
 * visible under a forced-colours mode, where a fill would vanish.
 */
const TONE: Record<TierId, string> = {
  NONE: 'text-ink-2',
  BRONZE: 'text-pending',
  SILVER: 'text-ink-2',
  GOLD: 'text-reward',
  PLATINUM: 'text-brand',
};

export interface TierBadgeProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  tier: TierId;
  /** Set false where the surrounding copy already names the tier. */
  showLabel?: boolean | undefined;
}

export function TierBadge({ tier, showLabel = true, className, ...rest }: TierBadgeProps) {
  const shape = SHAPES[tier];
  const label = LABELS[tier];

  return (
    <span className={['inline-flex items-center gap-1.5', TONE[tier]].join(' ')}>
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        // The shape is decoration *only* when the word is beside it. On its own
        // it is the whole message, so it takes the label.
        {...(showLabel ? { 'aria-hidden': true } : { role: 'img' as const, 'aria-label': label })}
        className={className}
        {...rest}
      >
        <path d={shape.path} />
      </svg>
      {showLabel ? <span className="text-caption">{label}</span> : null}
    </span>
  );
}

/** Exported for the test that proves no two tiers share a shape. */
export function tierShape(tier: TierId): { path: string; sides: string } {
  return SHAPES[tier];
}

export function tierLabel(tier: TierId): string {
  return LABELS[tier];
}
