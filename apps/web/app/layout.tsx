import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { TelegramHost } from '../components/TelegramHost';
import { THEME_BOOT_SCRIPT } from '../components/theme';
import { fontVariables } from './fonts';

export const metadata: Metadata = {
  /*
   * The Amharic name rides on the default title only (T-201, D1).
   *
   * `ሎሚ` is how students say it out loud, so it belongs where somebody meets the
   * product — a shared link, a browser tab on the home screen. Page titles use
   * the template instead, because "Practice · Lomi-Test (ሎሚ)" truncates to
   * nothing useful in a tab strip, and a name that only ever appears cut in half
   * is not a name.
   */
  title: {
    default: 'Lomi-Test (ሎሚ)',
    template: '%s · Lomi-Test',
  },
  applicationName: 'Lomi-Test',
  description:
    'Exit-exam preparation for Ethiopian university students — every answer fully explained.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
        {children}
      </body>
    </html>
  );
}
