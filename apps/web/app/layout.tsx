import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '../components/AppShell';
import { ServiceWorker } from '../components/ServiceWorker';
import { TelegramHost } from '../components/TelegramHost';
import { THEME_BOOT_SCRIPT } from '../components/theme';
import { fontVariables } from './fonts';

export const metadata: Metadata = {
  /*
   * The Amharic name rides on the default title only (T-201, D1).
   *
   * `ሎሚ` is how students say it out loud, so it belongs where somebody meets the
   * product — a shared link, a browser tab on the home screen. Page titles use
   * the template instead, because "Practice · Lomi-Exams" truncates to
   * nothing useful in a tab strip, and a name that only ever appears cut in half
   * is not a name.
   */
  title: {
    default: 'Lomi-Exams',
    template: '%s · Lomi-Exams',
  },
  applicationName: 'Lomi-Exams',
  // iOS reads these rather than the manifest.
  appleWebApp: { capable: true, title: 'Lomi-Exams', statusBarStyle: 'default' },
  icons: {
    /*
     * The SVG first, and it is a different drawing.
     *
     * A tab renders this at 16–20px. Dropping the leaves there was the brand
     * handoff's own rule and still not enough — the body outline, its two nubs
     * and the check are four strokes inside twenty pixels and they merge, which
     * an audit reported as "a yellow square with a dark smudge". The smallest
     * size therefore has its own drawing: the tile and one bold check, no
     * fruit. The 192px PNG stays behind it for anything that cannot read SVG,
     * and is what a bookmark or a shortcut takes.
     */
    icon: [
      { url: '/brand/lomi-favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/lomi-test-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/brand/lomi-test-apple-180.png', sizes: '180x180', type: 'image/png' }],
  },
  description:
    'Exit-exam preparation for Ethiopian university students — every answer fully explained.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  /*
   * The colour a phone paints its own chrome, matched to the app's ground
   * rather than to the brand (T-202).
   *
   * Installed, this is the band above the content; setting it to Brand Violet
   * would put a violet bar over a screen whose rule is that violet means the
   * primary action. Per-scheme, because the ground is re-derived in dark rather
   * than dimmed, and one value would be wrong in one of them.
   */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F6FB' },
    { media: '(prefers-color-scheme: dark)', color: '#101018' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body>
        {/*
          Runs before the page paints (T-098).

          FIRST CHILD OF <body>, not inside <head>. A <script> rendered into
          <head> from the App Router is discarded by React's head management —
          it appears in the served HTML and never executes, so a student whose
          phone is in dark mode gets a light page. Verified: with `prefers-
          color-scheme: dark` and nothing stored, the head version left
          `<html>` with no `dark` class at all.

          As the first body child it is parsed and run before any content below
          it renders, which is what avoids the white flash. `suppressHydration-
          Warning` on <html> because this legitimately changes its class before
          React sees it.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* No-op outside Telegram; see the component. */}
        <TelegramHost />
        {/* No-op outside production; see the component. */}
        <ServiceWorker />
        {/* Navigation and the reading measure come from here, so no page can
            disagree with DESIGN.md about either. */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
