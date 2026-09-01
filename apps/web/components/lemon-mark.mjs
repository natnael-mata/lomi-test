/**
 * The lemon mark, as geometry (T-269).
 *
 * **One copy of the drawing, used by three things.** `LemonMark.tsx` renders it
 * as JSX on every screen, `scripts/brand-icons.mjs` rasterises it into the app
 * icons, and the favicon is generated from it. A mark that is drawn twice is a
 * mark that is eventually two marks — the app icon quietly a version behind the
 * one in the navigation, and nobody looking at both at once.
 *
 * Plain `.mjs` rather than `.ts` for exactly that reason: the icon script is a
 * Node script with no build step, and the web app has `allowJs`, so this is the
 * one format both can import directly. Nothing here is TypeScript-shaped
 * anyway — it is a handful of path strings.
 *
 * ## The drawing
 *
 * A whole lemon on a 24×24 grid: an oval body tilted 20° with a nub at each end
 * of its long axis, a cream glint on the upper shoulder, twin mint leaves on a
 * short stem, and the mint check stroke from the answer screens laid across it.
 * The check is the point — this is an exam-practice product, and the fruit is
 * the name (ሎሚ means lemon).
 *
 * **Leaves come off below 24px.** At a 20px favicon two 3px leaves are four
 * grey pixels and a suggestion; the fruit and the check still read. That is the
 * supplied design's own rule, and `LemonMark` applies it rather than leaving it
 * to each caller to remember.
 */

/**
 * The palette, as literals.
 *
 * The component prefers the CSS custom properties so a token change reaches it,
 * and these are the fallbacks — but the icon script rasterises outside the app
 * and has no stylesheet, so it needs the values. `lemon-mark.test.ts` holds
 * them against `design-system/tailwind-theme.css` and fails if either moves.
 */
export const MARK_COLORS = {
  ink: '#1a3300',
  mint: '#d5f5c2',
  cream: '#fcfaf5',
  lemon: '#ffe95c',
};

/** The body, tilted so the nubs sit at roughly two and eight o'clock. */
export const BODY_TILT = 'rotate(-20 12 13.6)';
export const BODY = { cx: 12, cy: 13.6, rx: 8.4, ry: 7.1 };

/** The spurs at each end of the long axis, drawn inside the tilted group. */
export const NUB_RIGHT = 'M20.4 13.6 h2.1';
export const NUB_LEFT = 'M3.6 13.6 h-2.1';

/**
 * The glint on the upper shoulder. Cream, so it reads on the lemon fill.
 *
 * Kept well clear of the rim. A longer arc nearer the edge overlapped the ink
 * outline and, being drawn after it, took a white bite out of it at one
 * o'clock — which at 512px reads as a printing fault rather than a highlight.
 */
export const GLINT = 'M15.6 9.6 a5.6 4.8 0 0 1 1.7 2.0';

/** Twin leaves and the stem they sit on. Dropped below 24px — see above. */
export const LEAF_LEFT = 'M12 7.2 C 11.7 4.1 9.6 2.3 7.0 2.4 C 7.0 5.4 9.2 7.2 12 7.2 Z';
export const LEAF_RIGHT = 'M12 7.2 C 12.3 4.1 14.4 2.3 17.0 2.4 C 17.0 5.4 14.8 7.2 12 7.2 Z';
export const STEM = 'M12 8.9 V 6.6';

/**
 * The check. The same gesture the answer screens draw over a correct option.
 *
 * **Drawn twice: ink underneath, mint on top.** The handoff calls it "the
 * mint-on-ink correct stroke", and the reason shows up the moment it is not —
 * mint on the yellow tile is 1.2:1 and the check simply vanishes, leaving a
 * lemon with a smudge in it. The ink underlay is what makes it a check on
 * yellow, on cream, and at 20px.
 */
export const CHECK = 'M8.4 13.9 l2.6 2.6 l5.2 -5.7';
export const CHECK_INK_WIDTH = 4.2;
export const CHECK_MINT_WIDTH = 2.2;

/** The size below which the leaves are dropped. */
export const LEAVES_MIN_PX = 24;

/**
 * The mark as an SVG string, for anything outside React.
 *
 * `filled` draws the lemon body in brand yellow — right on cream, wrong inside
 * the yellow nav tile, where the tile already is the fruit and a second yellow
 * on top of it just thickens the outline.
 */
export function lemonMarkSvg({ size = 24, leaves = true, filled = true } = {}) {
  const c = MARK_COLORS;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g transform="${BODY_TILT}">
    <path d="${NUB_RIGHT}" stroke="${c.ink}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="${NUB_LEFT}" stroke="${c.ink}" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="${BODY.cx}" cy="${BODY.cy}" rx="${BODY.rx}" ry="${BODY.ry}" fill="${filled ? c.lemon : 'none'}" stroke="${c.ink}" stroke-width="1.5"/>
    <path d="${GLINT}" stroke="${c.cream}" stroke-width="1.3" stroke-linecap="round"/>
  </g>
  ${
    leaves
      ? `<path d="${LEAF_LEFT}" fill="${c.mint}" stroke="${c.ink}" stroke-width="1.35" stroke-linejoin="round"/>
  <path d="${LEAF_RIGHT}" fill="${c.mint}" stroke="${c.ink}" stroke-width="1.35" stroke-linejoin="round"/>
  <path d="${STEM}" stroke="${c.ink}" stroke-width="1.45" stroke-linecap="round"/>`
      : ''
  }
  <path d="${CHECK}" stroke="${c.ink}" stroke-width="${CHECK_INK_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${CHECK}" stroke="${c.mint}" stroke-width="${CHECK_MINT_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
