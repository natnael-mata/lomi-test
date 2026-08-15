'use client';

/**
 * The product's navigation (DESIGN.md § Navigation).
 *
 * DESIGN.md, verbatim: *"Bottom bar on phones: exactly five labelled
 * destinations, 56px, with the active item's icon sitting in a Brand Soft pill
 * and its label in brand colour. Labels are never hidden. Desktop moves the same
 * five to a left rail."*
 *
 * Every clause of that is load-bearing:
 *
 * - **Exactly five.** Not four, not six. A sixth destination means something
 *   here is not a destination, and the fix is to remove it rather than to
 *   shrink the bar.
 * - **Labels are never hidden.** Not at any width, not on scroll. An icon-only
 *   bar asks a stressed student to recognise five glyphs they have seen twice.
 * - **The active item is a Brand Soft pill plus a brand-coloured label** —
 *   colour never carries the meaning alone, which is the rule the whole design
 *   system is built on.
 * - **56px**, and the touch target rule (≥44px) is satisfied by the row.
 *
 * One component for both layouts rather than two, so the five can never drift
 * apart between phone and desktop.
 */
import type { ReactNode } from 'react';

import { copy } from '../lib/i18n';

export interface Destination {
  href: string;
  label: string;
  icon: ReactNode;
}

/**
 * The five. In the order a student meets them: practise, sit a mock, see where
 * you are, see where you stand, pay.
 */
const c = copy();

export const DESTINATIONS: readonly Destination[] = [
  {
    href: '/practice',
    label: c.nav.practice,
    icon: <path d="M4 5h16M4 12h16M4 19h10" strokeLinecap="round" />,
  },
  {
    href: '/exam',
    label: c.nav.exam,
    icon: <path d="M6 3h9l5 5v13H6zM15 3v5h5M9 13h6M9 17h4" strokeLinejoin="round" />,
  },
  {
    href: '/progress',
    label: c.nav.progress,
    icon: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" strokeLinecap="round" />,
  },
  {
    href: '/standing',
    label: c.nav.standing,
    icon: (
      <path
        d="M12 3l2.6 5.6L21 9.3l-4.5 4.2 1.2 6.1L12 16.7 6.3 19.6l1.2-6.1L3 9.3l6.4-.7z"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: '/checkout',
    label: c.nav.checkout,
    icon: <path d="M3 8h18v11H3zM3 8l2-4h14l2 4M8 13h8" strokeLinejoin="round" />,
  },
];

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      // Decoration: the label beside it is the accessible name, and reading both
      // would announce every destination twice.
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function Item({ destination, active }: { destination: Destination; active: boolean }) {
  return (
    <a
      href={destination.href}
      // The pill AND the brand-coloured label. Colour never alone.
      className={[
        'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-2',
        'sm:flex-none sm:flex-row sm:justify-start sm:gap-3 sm:px-3',
        active ? 'bg-brand-soft text-brand' : 'text-ink-2',
      ].join(' ')}
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      <Glyph>{destination.icon}</Glyph>
      {/* Never hidden, at any width. */}
      <span className="text-caption">{destination.label}</span>
    </a>
  );
}

/**
 * The bottom bar. Phones only — the rail replaces it from `sm` up.
 *
 * `pb-[env(safe-area-inset-bottom)]` so it clears the home indicator on a phone
 * that has one, rather than sitting under it.
 */
export function BottomBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="bg-surface border-border fixed inset-x-0 bottom-0 z-10 flex border-t pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {DESTINATIONS.map((d) => (
        <Item key={d.href} destination={d} active={isActive(pathname, d.href)} />
      ))}
    </nav>
  );
}

/** The same five, as a left rail. Desktop and tablet. */
export function SideRail({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="bg-surface border-border fixed inset-y-0 left-0 z-10 hidden w-56 flex-col gap-1 border-r p-4 sm:flex"
    >
      <span className="text-label mb-4 px-3">Lomi-Test</span>
      {DESTINATIONS.map((d) => (
        <Item key={d.href} destination={d} active={isActive(pathname, d.href)} />
      ))}
    </nav>
  );
}

/**
 * Whether a destination is the current one.
 *
 * Prefix matching, so `/community/<topic>` still lights Practise rather than
 * leaving a student on a screen with nothing selected — which reads as being
 * lost.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/practice') return pathname === '/' || pathname.startsWith('/practice');
  return pathname === href || pathname.startsWith(`${href}/`);
}
