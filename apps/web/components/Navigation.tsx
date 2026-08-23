'use client';

/**
 * The product's navigation (DESIGN.md § Navigation, design handoff 1a/1c/1d).
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
 * - **The active item is a Brand Soft pill plus a heavier, darker label** —
 *   colour never carries the meaning alone, which is the rule the whole design
 *   system is built on. DESIGN.md says "label in brand colour"; that clause is
 *   retired with Lomi v1, where the brand is a lemon that cannot legibly set
 *   text. Weight and ink strength carry it instead, and the pill is unchanged.
 * - **56px**, and the touch target rule (≥44px) is satisfied by the row.
 *
 * The handoff adds a third width between the two DESIGN.md names. A tablet is
 * too narrow for a 232px rail beside a 640px measure and too wide for a bar
 * pinned to the bottom edge, so it gets the rail **compacted** — 104px, icon
 * over label — rather than either neighbour's layout stretched to fit. The
 * labels survive the compaction; that is the whole point of compacting rather
 * than dropping to icons.
 *
 * One component for all three rather than three, so the five can never drift
 * apart between phone, tablet and desktop.
 */
import { useEffect, useState } from 'react';

import { Icon, type IconName } from './icons';
import { Logo } from './Logo';
import { api } from '../lib/api';
import { day } from '../lib/dates';
import { copy } from '../lib/i18n';

export interface Destination {
  href: string;
  label: string;
  icon: IconName;
}

/**
 * The five. In the order a student meets them: practise, sit a mock, see where
 * you are, see where you stand, pay.
 */
const c = copy();

export const DESTINATIONS: readonly Destination[] = [
  { href: '/practice', label: c.nav.practice, icon: 'practise' },
  { href: '/exam', label: c.nav.exam, icon: 'mock' },
  { href: '/progress', label: c.nav.progress, icon: 'progress' },
  { href: '/standing', label: c.nav.standing, icon: 'standing' },
  { href: '/checkout', label: c.nav.checkout, icon: 'access' },
];

/**
 * One destination, in whichever of the three shapes the viewport asks for.
 *
 * The shapes differ enough that writing them as three components is tempting,
 * and that is exactly how a fifth destination ends up in two of them. The
 * breakpoints are: phone — a column in the bottom bar; tablet (`sm`) — a column
 * in the compact rail; desktop (`lg`) — a row in the full rail.
 */
function Item({ destination, active }: { destination: Destination; active: boolean }) {
  return (
    <a
      href={destination.href}
      className={[
        // Phone: a fifth of the bar, stacked, 56px.
        'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-px px-1',
        // Tablet and desktop: a row in the horizontal pill, sized to its own
        // content rather than to a rail's width (handoff frame 3a).
        'sm:min-h-11 sm:w-auto sm:flex-none sm:flex-row sm:gap-2 sm:rounded-full sm:px-3.5 sm:py-2',
        // The pill AND weight. This used to lean on a brand-coloured label, but
        // the lemon cannot set text (1.23:1 on cream), so active is now carried
        // by full-strength ink at 600 against ink-2 at 400 — a contrast step
        // from 6.72:1 to 13.27:1 plus a weight step, with the wash behind it.
        // On a phone the pill sits behind the icon only: a filled cell in a
        // 56px bar reads as a button rather than as "you are here".
        active ? 'text-ink font-semibold sm:bg-correct-soft' : 'text-ink-2',
      ].join(' ')}
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      <span
        className={
          active
            ? 'bg-correct-soft inline-flex rounded-full px-3 py-0.5 sm:bg-transparent sm:p-0'
            : ''
        }
      >
        <Icon name={destination.icon} size={22} />
      </span>
      {/* Never hidden, at any width — only resized. */}
      <span className="text-[11px] font-semibold sm:text-[13px] lg:text-label">
        {destination.label}
      </span>
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
      aria-label={c.nav.main}
      // The phone bar stays edge-to-edge: a floating card at the bottom of a
      // 390px screen costs 32px of width the question stem needs, and the
      // safe-area inset already keeps it clear of the home indicator.
      className="bg-surface border-border fixed inset-x-0 bottom-0 z-10 flex border-t pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {DESTINATIONS.map((d) => (
        <Item key={d.href} destination={d} active={isActive(pathname, d.href)} />
      ))}
    </nav>
  );
}

/** The same five, as a left rail. 104px on a tablet, 232px from `lg`. */
export function SideRail({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label={c.nav.main}
      /*
        A floating card, not a wall (handoff bundle, 2026-08-23).
        It was a full-height rail glued to the left edge with a border. The
        design lifts it off the paper: a rounded card inset from the edge,
        one hairline, and the only shadow in the whole system — a long soft
        lemon glow rather than a grey drop, because grey next to cream reads
        as dirt.
      */
      /*
        A floating pill across the top, not a rail down the side (handoff 3a:
        "the left rail is gone").

        The rail cost 232px of every desktop screen for five links, on a product
        whose content measure is 680px — a quarter of the window spent on
        navigation that never changes. Across the top it costs 72px of height
        once, and the measure gets the width back.

        16px radius, one pencil-gray hairline, and the only shadow in the system
        — a long soft lemon glow, because a grey drop next to cream reads as
        dirt.
      */
      className="bg-surface border-border rounded-panel shadow-nav fixed inset-x-4 top-4 z-10 hidden items-center gap-2 border px-3 py-2 sm:flex lg:mx-auto lg:max-w-[1100px]"
    >
      <span className="mb-4 flex justify-center lg:mb-6 lg:justify-start lg:px-3">
        {/* The glyph alone where there is no room for the wordmark beside it. */}
        <Logo size={34} className="lg:hidden" />
        <Logo size={34} wordmark className="hidden lg:inline-flex" />
      </span>

      {DESTINATIONS.map((d) => (
        <Item key={d.href} destination={d} active={isActive(pathname, d.href)} />
      ))}

      <RailFooter />
    </nav>
  );
}

/**
 * What the rail says at the bottom: when access runs out.
 *
 * It carried the theme switch until Lomi v1 dropped dark mode; the slot stays
 * because the access date is the thing a student actually looks for here.
 *
 * Desktop only. On a tablet the rail is 104px wide and a date does not fit in
 * it at a readable size — and the answer to "it does not fit" is never to set
 * it at 11px, so it moves to the checkout screen, where the same date is
 * already stated.
 *
 * **Renders nothing until the answer is known, and nothing at all for a student
 * with no subscription.** An empty slot is honest; "Access until —" is not, and
 * neither is a date guessed from a plan the student has not bought.
 */
function RailFooter() {
  const [until, setUntil] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const status = await api.mySubscription();
        if (live && status.active && status.expiresAt) {
          setUntil(day(status.expiresAt));
        }
      } catch {
        // Signed out, or offline. The rail is navigation; it does not get to
        // report a network fault the student cannot act on.
      }
    })();
    void (async () => {
      try {
        const me = await api.me();
        if (live) setWho(me.displayName);
      } catch {
        // Same reasoning. No name shown is better than an error in the rail.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="mt-auto hidden flex-col gap-3 px-3 lg:flex">
      {/*
        Who you are, which nothing in the product said (T-251).

        Both QA passes filed this as a blocker. With a door that switches
        between twelve accounts, a sign-in that silently did not take is
        invisible — one tester nearly reported several findings against the
        wrong account and the other did. It matters outside testing too: a
        student on a shared phone has the same question.

        The generated handle, never a legal name — the same one the leaderboard
        would show.
      */}
      {who === null ? null : (
        <span className="flex flex-col" data-signed-in-as="">
          <span className="text-caption text-ink-2 uppercase">{c.nav.signedInAs}</span>
          <span className="text-label truncate">{who}</span>
        </span>
      )}
      {until === null ? null : (
        <span className="text-caption text-ink-2 num uppercase">{c.nav.accessUntil(until)}</span>
      )}
    </div>
  );
}

/**
 * Whether a destination is the current one.
 *
 * Prefix matching, so `/checkout/return` still lights Access rather than
 * leaving a student on a screen with nothing selected — which reads as being
 * lost.
 */
export function isActive(pathname: string, href: string): boolean {
  // `/` used to mean Practise, back when the root route was the hub. It is the
  // public landing page now, is unframed, and never renders this navigation.
  return pathname === href || pathname.startsWith(`${href}/`);
}
