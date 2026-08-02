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
 * Display face — headings, the countdown, the mock score. DESIGN.md uses 700 and
 * 800, both inside this variable range.
 */
export const gabarito = localFont({
  src: './fonts/gabarito-variable.woff2',
  variable: '--font-gabarito',
  weight: '400 900',
  // `swap` renders text immediately in the fallback and swaps when the face
  // arrives; `block` would hide the question stem for up to three seconds.
  display: 'swap',
  // Fallback metrics, so the swap does not move the layout — this is what keeps
  // CLS at 0 rather than merely small.
  adjustFontFallback: 'Arial',
  fallback: ['system-ui', 'sans-serif'],
});

/** Body face — the question stem and everything else read at length. */
export const figtree = localFont({
  src: './fonts/figtree-variable.woff2',
  variable: '--font-figtree',
  weight: '300 900',
  display: 'swap',
  adjustFontFallback: 'Arial',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/**
 * Amharic. Loaded with the Latin faces rather than on demand: the app is
 * bilingual by default (T-101), and a Ge'ez glyph rendered in a fallback face
 * beside Figtree is immediately visible as wrong.
 */
export const ethiopic = localFont({
  src: './fonts/noto-sans-ethiopic-variable.woff2',
  variable: '--font-ethiopic',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

/** Every font variable, for the `<html>` element. */
export const fontVariables = [gabarito.variable, figtree.variable, ethiopic.variable].join(' ');
