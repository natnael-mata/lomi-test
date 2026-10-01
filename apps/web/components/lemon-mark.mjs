/**
 * The lemon slice, as geometry (T-270).
 *
 * **One copy of the drawing, used by three things.** `LemonMark.tsx` renders it
 * as JSX on every screen, `scripts/brand-icons.mjs` rasterises it into the app
 * icons, and the favicon is generated from it. A mark that is drawn twice is a
 * mark that is eventually two marks — the app icon quietly a version behind the
 * one in the navigation, and nobody looking at both at once.
 *
 * Plain `.mjs` for exactly that reason: the icon script is a Node script with no
 * build step, and the web app has `allowJs`, so this is the one format both can
 * import directly.
 *
 * ## The drawing
 *
 * A lemon cut across, on a 200×200 grid centred on the origin — which is what
 * makes the four wedges expressible as arcs from `0 0` rather than as a table of
 * offsets. Outside in: rind, pith, four flesh wedges separated by pith-coloured
 * strokes, and a pith dot at the centre.
 *
 * **It was a whole fruit with a check through it until 2026-10-01.** That mark
 * had to carry the product's meaning as well as its name — hence the tick — and
 * the redesign moves that job to the interface, leaving the mark free to be the
 * name alone. A slice also survives scale far better: it is four shapes with no
 * thin strokes and no notch, where the whole fruit lost its leaves below 24px
 * and its outline merged at 16.
 */

/**
 * The palette, as literals.
 *
 * The component prefers the CSS custom properties so a token change reaches it,
 * and these are the fallbacks — but the icon script rasterises outside the app
 * and has no stylesheet, so it needs the values. `lemon-mark.test.ts` holds them
 * against `design-system/tailwind-theme.css` and fails if either moves.
 */
export const MARK_COLORS = {
  rind: '#eab308',
  pith: '#fef08a',
  flesh: '#facc15',
};

/** Outside in. The viewBox is centred, so every radius is a plain `r`. */
export const RIND_R = 94;
export const PITH_R = 80;
export const FLESH_R = 70;
export const CENTER_R = 7;

/**
 * Four quarter wedges, drawn as one path.
 *
 * Each is a pie slice from the centre: out along an axis, round the arc, closed
 * back. One path rather than four so the pith-coloured stroke between them is a
 * single `stroke-linejoin`, which is what gives the clean cross at the middle.
 */
export const WEDGES = [
  'M0 0 L0 -70 A70 70 0 0 1 70 0Z',
  'M0 0 L70 0 A70 70 0 0 1 0 70Z',
  'M0 0 L0 70 A70 70 0 0 1 -70 0Z',
  'M0 0 L-70 0 A70 70 0 0 1 0 -70Z',
].join(' ');

/** The gap between wedges, drawn as a stroke in the pith colour. */
export const WEDGE_STROKE = 9;

/**
 * The mark as an SVG string, for anything outside React.
 *
 * `centerDot` is dropped at the smallest sizes: a 7-unit dot on a 200 grid is
 * one pixel at 20px square, which renders as a smudge in the middle of the
 * cross rather than as a detail.
 */
export function lemonMarkSvg({ size = 24, centerDot = true } = {}) {
  const c = MARK_COLORS;
  return `<svg width="${size}" height="${size}" viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle r="${RIND_R}" fill="${c.rind}"/>
  <circle r="${PITH_R}" fill="${c.pith}"/>
  <path d="${WEDGES}" fill="${c.flesh}" stroke="${c.pith}" stroke-width="${WEDGE_STROKE}" stroke-linejoin="round"/>
  ${centerDot ? `<circle r="${CENTER_R}" fill="${c.pith}"/>` : ''}
</svg>`;
}
