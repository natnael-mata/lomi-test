/**
 * Self-hosted fonts (T-091).
 *
 * `next/font/local` over `next/font/google`, and the files are committed. Two
 * reasons, in order of how much they matter:
 *
 * 1. **No third party on the critical path.** A request to `fonts.googleapis.com`
 *    on every page load tells Google which students open an exam-prep app and
 *    when. On a filtered or slow Ethiopian connection it is also a blocking
 *    request to a host that may not answer, and the text a student came to read
 *    waits on it.
 * 2. **No network at build time.** `next/font/google` downloads during the build,
 *    so a CI runner or an offline machine either stalls or — worse — **silently
 *    falls back to system-ui and builds successfully**. That failure looks
 *    exactly like success. It happened on this machine: the download timed out
 *    over IPv6 and the page rendered in the fallback face with the correct
 *    family names still sitting in the computed stack.
 *
 * The files are the variable woff2 from Google Fonts: latin subset for the Latin
 * faces and **ethiopic** for Noto. That subset choice is load-bearing — the latin
 * cut of an Ethiopic font contains no Ge'ez glyphs at all, so it would render
 * every Amharic string in a fallback while appearing to be loaded correctly.
 *
 * Each font exposes a CSS variable that `design-system/tailwind-theme.css`
 * consumes. Naming the family directly in the theme would fall back to system-ui
 * while looking perfectly correct in the stack.
 */
import localFont from 'next/font/local';

/**
 * Display face — headings, the countdown, the mock score.
 *
 * **Outfit**, from the 2026-10-01 redesign, which names it for every heading at
 * 600/700/800. It replaces Bricolage Grotesque, and the swap fixes a real defect
 * rather than only changing the look: Bricolage shipped here as Regular and Bold
 * only, so 700 and 800 pointed at the same file and `font-extrabold` rendered
 * identically to `font-bold`. Outfit's release is a single variable face with a
 * wght axis covering 100–900, so the three weights the design asks for are three
 * weights.
 *
 * One variable file at 14.8KB, against the 20KB of the single Bricolage cut it
 * replaces — the right typeface is also the cheaper download, which is the only
 * kind of win worth having on a metered Ethiopian connection.
 *
 * SIL Open Font License, whose text ships beside it in `fonts/Outfit-OFL.txt`
 * because the licence requires it and a font shipped without its licence is not
 * licensed.
 */
export const outfit = localFont({
  src: './fonts/outfit-variable.woff2',
  variable: '--font-display-face',
  // The whole axis, so 600, 700 and 800 are genuinely distinct cuts rather than
  // one weight the browser smears into the other two.
  weight: '100 900',
  // `swap` renders text immediately in the fallback and swaps when the face
  // arrives; `block` would hide the question stem for up to three seconds.
  display: 'swap',
  // Fallback metrics, so the swap does not move the layout — this is what keeps
  // CLS at 0 rather than merely small.
  adjustFontFallback: 'Arial',
  fallback: ['system-ui', 'sans-serif'],
});

/**
 * Body face — the question stem and everything else read at length.
 *
 * Inter is what both the previous direction and the redesign name for its
 * functional role, and it holds up at the 16px mobile floor on a low-end
 * Android, which is where nearly all of this product is read. Unchanged.
 *
 * No mono face is shipped. The redesign names `ui-monospace, Menlo` for
 * formulas, which resolves to a face already on the device — so the one place
 * this design wants monospace costs nothing to serve.
 */
export const inter = localFont({
  src: './fonts/inter-variable.woff2',
  variable: '--font-body-face',
  weight: '100 900',
  display: 'swap',
  adjustFontFallback: 'Arial',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/*
 * The Ethiopic face was removed on 2026-08-20 with the move to English only.
 *
 * It was 198KB — larger than Archivo and Inter combined — and it was downloaded
 * by every student on every first load so that one logo glyph could render. The
 * exam is set in English and so is the product now, so nothing needs Ge'ez
 * coverage and the mark is Latin.
 *
 * The subset note above still matters if it ever returns: the *latin* cut of an
 * Ethiopic font contains no Ge'ez glyph at all, so it loads successfully and
 * renders every Amharic string in a fallback.
 */

/** Every font variable, for the `<html>` element. */
export const fontVariables = [outfit.variable, inter.variable].join(' ');
