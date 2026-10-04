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
   * The bare name on the default, the template everywhere else.
   *
   * A page title reads "Practice · Lomi-Exams", which truncates to something
   * useful in a tab strip; the default is what a shared link or a home-screen
   * shortcut shows, and there the product's own name is the whole point.
   *
   * This carried `ሎሚ` until the move to English only — the exam is set in
   * English and so is the product.
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
     * The SVG first, because a tab renders it at 16–20px.
     *
     * The previous mark — a whole lemon with leaves and a check — needed a
     * second, simpler drawing at this size: an audit rendered it at 16px and
     * reported "a yellow square with a dark smudge". The slice needs no such
     * compromise; it is the same drawing with the centre dot dropped, which is
     * one pixel at tab size. The 192px PNG stays behind it for anything that
     * cannot read SVG, and is what a bookmark or a shortcut takes.
     */
    icon: [
      { url: '/brand/lomi-favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/lomi-exams-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/brand/lomi-exams-apple-180.png', sizes: '180x180', type: 'image/png' }],
  },
  description:
    'Exit exam preparation for Ethiopian university students. Every answer fully explained.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  /*
   * The colour a phone paints its own chrome, matched to the app's ground
   * rather than to the brand (T-202).
   *
   * Installed, this is the band above the content; setting it to the brand
   * yellow would put a yellow bar over a screen whose rule is that yellow means
   * the primary action.
   *
   * One value, not a pair. It listed a light and a dark colour from the days
   * this product had two themes — and the pair outlived the themes by a month,
   * which is how a phone ended up able to paint a chrome colour for a mode the
   * app cannot render. `--color-bg`.
   */
  themeColor: '#f8fafc',
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
