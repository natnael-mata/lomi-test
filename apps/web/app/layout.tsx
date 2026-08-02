import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { fontVariables } from './fonts';

export const metadata: Metadata = {
  title: 'Lomi-Test',
  description:
    'Exit-exam preparation for Ethiopian university students — every answer fully explained.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
