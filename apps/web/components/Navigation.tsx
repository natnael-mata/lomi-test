'use client';

/**
 * The product's navigation (redesign handoff, 2026-10-01, § Responsive rules).
 *
 * Two shapes, one list:
 *
 * - **Desktop, 1024 and up:** a sticky 240px sidebar holding the logo, the five
 *   destinations and an access card.
 * - **Below that:** a sticky top bar carrying the logo and the page title, plus
 *   a fixed five-tab bottom bar with safe-area padding.
 *
 * **Five destinations, down from six.** Today, Practice, Mocks, Progress,
 * Account. The previous bar carried Practise / Mock / Progress / Standing /
 * Ask / Access, and the redesign folds three of those away: Access moves into
 * Account, Standing's points and streak move onto Today and Progress, and Ask
 * is reached from Today rather than from the bar. Nothing is deleted — the
 * routes all still exist and are all still linked — but the bar is for the five
 * places a student goes daily, and six icons on a 375px screen was already the
 * limit DESIGN.md warned about.
 *
 * One component for both shapes rather than two, so the five can never drift
 * apart between phone and desktop.
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

const c = copy();

/**
 * The five, in the order a student meets them: see the day, practise, sit a
 * mock, see how it is going, manage the account.
 */
export const DESTINATIONS: readonly Destination[] = [
  { href: '/today', label: c.nav.today, icon: 'today' },
  { href: '/practice', label: c.nav.practice, icon: 'practise' },
  { href: '/mocks', label: c.nav.mocks, icon: 'mock' },
  { href: '/progress', label: c.nav.progress, icon: 'progress' },
  { href: '/account', label: c.nav.account, icon: 'account' },
];

/**
 * One destination, in whichever of the two shapes the viewport asks for.
 *
 * Writing them as two components is tempting and is exactly how a sixth
 * destination ends up in one of them.
 */
function Item({ destination, active }: { destination: Destination; active: boolean }) {
  return (
    <a
      href={destination.href}
      className={[
        // Phone: a fifth of the bar, stacked, 56px.
        'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1',
        // Desktop: a full-width row in the sidebar.
        'lg:min-h-11 lg:w-full lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-control lg:px-3 lg:py-2.5',
        // The fill AND the weight. Colour never carries "you are here" alone —
        // a filled row reads as a button in greyscale otherwise.
        active
          ? 'text-ink font-semibold lg:bg-brand-soft'
          : 'text-ink-3 lg:hover:bg-surface-2 lg:hover:text-ink',
      ].join(' ')}
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      <span
        className={
          // On a phone the pill sits behind the icon only: a filled cell in a
          // 56px bar reads as a button rather than as "you are here".
          active
            ? 'bg-brand-soft inline-flex rounded-full px-3 py-0.5 lg:bg-transparent lg:p-0'
            : ''
        }
      >
        <Icon name={destination.icon} size={22} />
      </span>
      {/* Never hidden, at any width — only resized. */}
      <span className="text-[11px] font-semibold lg:text-[15px]">{destination.label}</span>
    </a>
  );
}

/**
 * The bottom bar. Below `lg` — the sidebar replaces it from 1024 up.
 *
 * `pb-[env(safe-area-inset-bottom)]` so it clears the home indicator on a phone
 * that has one, rather than sitting under it.
 */
export function BottomBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label={c.nav.mainBottom}
      className="bg-surface border-border fixed inset-x-0 bottom-0 z-20 flex border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {DESTINATIONS.map((d) => (
        <Item key={d.href} destination={d} active={isActive(pathname, d.href)} />
      ))}
    </nav>
  );
}

/**
 * The top bar, below `lg`: the mark, and the page's own name.
 *
 * The mark is the only route to `/today` from a phone — the bottom bar has five
 * tabs and Today is one of them, so this is a second way rather than the only
 * way, which is the opposite of how it was before the redesign.
 */
export function TopBar({ title }: { title: string }) {
  return (
    <header className="bg-surface/90 border-border sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b px-4 backdrop-blur lg:hidden">
      <a
        href="/today"
        aria-label={c.nav.home}
        className="rounded-control inline-flex min-h-11 min-w-11 items-center justify-center"
      >
        <Logo size={28} />
      </a>
      {/* The page's name, so a screenshot of any screen says which it is. */}
      <span className="text-ink truncate font-display text-[17px] font-bold">{title}</span>
    </header>
  );
}

/**
 * The sidebar, 1024 and up. Sticky, 240px, and it scrolls with nothing.
 *
 * The access card at the foot is the one piece of state the navigation carries:
 * when a student's access runs out is the question they ask most often of this
 * product, and it is cheaper to answer it everywhere than to make them go and
 * look.
 */
export function SideRail({ pathname }: { pathname: string }) {
  return (
    <aside className="border-border bg-surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r px-4 py-6 lg:flex">
      <a
        href="/today"
        aria-label={c.nav.home}
        className="rounded-control inline-flex min-h-11 items-center"
      >
        <Logo size={32} wordmark />
      </a>

      <nav aria-label={c.nav.main} className="flex flex-col gap-1">
        {DESTINATIONS.map((d) => (
          <Item key={d.href} destination={d} active={isActive(pathname, d.href)} />
        ))}
      </nav>

      <AccessCard />
    </aside>
  );
}

/**
 * When access runs out, and the way to extend it.
 *
 * **Renders nothing until the answer is known, and nothing at all for a student
 * with no subscription.** An empty slot is honest; "Access until —" is not, and
 * neither is a date guessed from a plan nobody has bought.
 */
function AccessCard() {
  const [until, setUntil] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const status = await api.mySubscription();
        if (live && status.active && status.expiresAt) setUntil(day(status.expiresAt));
      } catch {
        // Signed out, or offline. The sidebar is navigation; it does not get to
        // report a network fault the student cannot act on.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    /*
      A white card with a hairline, not a grey well.
      
      It was `surface-2`, and the layout sweep rejected it twice: the muted ink
      is 4.34:1 on that fill and the link 4.49:1 — both just under AA, and both
      fine on white. The redesign's card IS white, so this was also the odd one
      out visually. `ink-2` rather than `ink-3` for the label for the same
      reason, with room to spare.
    */
    <div className="bg-surface border-border rounded-card mt-auto flex flex-col gap-1 border p-4">
      <span className="text-caption text-ink-2">
        {until === null ? c.nav.freePlan : c.nav.accessLabel}
      </span>
      <span className="text-ink num text-[15px] font-semibold">
        {until === null ? c.nav.freePlanBody : until}
      </span>
      {/* 44px of target, like every other control. A 26px link is one the
          sweep catches and a thumb does not. */}
      <a
        href="/account"
        className="text-link hover:text-link-hover -mx-1 inline-flex min-h-11 items-center px-1 text-[14px] font-semibold"
      >
        {until === null ? c.nav.seePlans : c.nav.manage}
      </a>
    </div>
  );
}

/**
 * Whether a destination is the current one.
 *
 * Prefix matching, so `/exam/review/…` still lights Mocks rather than leaving a
 * student on a screen with nothing selected — which reads as being nowhere.
 */
export function isActive(pathname: string, href: string): boolean {
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return under(href) || (ALIASES[href] ?? []).some(under);
}

/**
 * Routes that belong to a destination without living under its path.
 *
 * A mock's results are at `/exam/review/…`, an address older than the Mocks
 * tab. Without this a student reading their paper had no tab lit at all, which
 * reads as being nowhere.
 */
const ALIASES: Record<string, readonly string[]> = {
  '/mocks': ['/exam'],
};
