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
import { SignOutButton } from './SignOutButton';
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
  /*
   * The community, and it belongs here because it is scoped to the student's
   * own programme.
   *
   * The worry was a free-text surface spanning Grade 6 to university. That is
   * not what this is: topics belong to a programme, the server refuses a post
   * into another one with `WRONG_FIELD`, and the index only ever lists the
   * student's own. There is no room where an eleven-year-old and an
   * undergraduate meet.
   */
  { href: '/community', label: c.nav.community, icon: 'community' },
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
        // The pill-row shape belongs to the rail, so it starts where the rail
        // now starts. It was `sm:`, which reshaped the items at 640px while the
        // bar they were in did not appear until 1024.
        'lg:min-h-11 lg:w-auto lg:flex-none lg:flex-row lg:gap-2 lg:rounded-full lg:px-3.5 lg:py-2',
        // The pill AND weight. This used to lean on a brand-coloured label, but
        // the lemon cannot set text (1.23:1 on cream), so active is now carried
        // by full-strength ink at 600 against ink-2 at 400 — a contrast step
        // from 6.72:1 to 13.27:1 plus a weight step, with the wash behind it.
        // On a phone the pill sits behind the icon only: a filled cell in a
        // 56px bar reads as a button rather than as "you are here".
        // `brand-soft`, not `correct-soft`. The active pill was drawn in the
        // fill that means "this answer is right", so the highlight around
        // Progress was the same colour as a correct option. The theme's own
        // token comment assigns brand-soft to "selected option, active nav".
        active ? 'text-ink font-semibold lg:bg-brand-soft' : 'text-ink-2',
      ].join(' ')}
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      <span
        className={
          active
            ? 'bg-brand-soft inline-flex rounded-full px-3 py-0.5 lg:bg-transparent lg:p-0'
            : ''
        }
      >
        <Icon name={destination.icon} size={22} />
      </span>
      {/* Never hidden, at any width — only resized. */}
      <span className="text-[11px] font-semibold lg:text-label">
        {destination.label}
      </span>
    </a>
  );
}

/**
 * The mark, at the top of a phone screen, linking home (T-269).
 *
 * **Below `lg` there was no route to `/home` anywhere in the product**, and no
 * brand mark on screen at all — the pill that carries both is desktop-only, and
 * the bottom bar's six destinations do not include the hub. A seventh bottom-bar
 * item is the wrong answer (DESIGN.md: "if a seventh is ever proposed… the
 * answer is probably no"), so the mark goes where every other app on a
 * student's phone has taught them to look for it.
 *
 * Deliberately just the mark. It is 34px of height on a five-inch screen, and
 * each screen below it already has its own heading — a second title bar would
 * be taking the question stem's room to say something the page already says.
 */
export function TopMark() {
  return (
    <div className="flex px-4 pt-4 lg:hidden">
      <a href="/home" aria-label={c.nav.home} className="rounded-control inline-flex">
        <Logo size={34} />
      </a>
    </div>
  );
}

/**
 * The bottom bar. Phones and tablets — the pill replaces it from `lg` up.
 *
 * `pb-[env(safe-area-inset-bottom)]` so it clears the home indicator on a phone
 * that has one, rather than sitting under it.
 */
export function BottomBar({ pathname }: { pathname: string }) {
  return (
    <nav
      // Named apart from the pill's landmark. Both are "Main" navigation and
      // both are in the markup at once, so two identically labelled landmarks
      // show up in a landmark list even though only one is ever visible.
      aria-label={c.nav.mainBottom}
      // The phone bar stays edge-to-edge: a floating card at the bottom of a
      // 390px screen costs 32px of width the question stem needs, and the
      // safe-area inset already keeps it clear of the home indicator.
      /*
        Holds until `lg`, not `sm` (T-269).

        The bar hid at 640px and the pill appeared there, but the account block
        — "Signed in as", and the only Sign out in the chrome — was gated at
        1024px. So every width from 640 to 1023 had a rail with no way out of
        the account, and below about 757px the sixth destination overflowed the
        pill and clipped to "Ac" while the page scrolled sideways. A tablet, or
        a lab machine at 1024x768 with any browser chrome, landed in that gap.

        Six labelled destinations fit this bar at 375px, so it is the shape that
        works for the whole band. The pill takes over only where it can carry
        everything it is supposed to.
      */
      className="bg-surface border-border fixed inset-x-0 bottom-0 z-10 flex border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
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
      className="bg-surface border-border rounded-panel shadow-nav fixed inset-x-4 top-4 z-10 mx-auto hidden max-w-[1100px] items-center gap-2 border px-3 py-2 lg:flex"
    >
      {/*
        The mark is the way to `/home`, and it is a link (T-269).

        **Nothing in the product linked to `/home` at all.** The six
        destinations go to Practise, Mock, Progress, Standing, Ask and Access;
        the hub that tells a paid student when their access ends, and a
        paywalled one that they have run out, was reachable only by typing the
        URL. The brand tile was a `<span>`, which is the one place every other
        app on a student's phone has taught them to press.

        No bottom margin: `mb-4`/`lg:mb-6` were spacing under a logo that sat at
        the top of a vertical rail; in a horizontal pill they are 24px of height
        added to the tallest child, which is every row of the bar.
      */}
      <a
        href="/home"
        aria-label={c.nav.home}
        className="rounded-control flex shrink-0 justify-center lg:justify-start lg:px-2"
      >
        {/*
          The glyph alone where there is no room for the wordmark beside it —
          which is now everything below `xl`, not just tablets.

          The wordmark is about 110px, and between 1024 and 1280 the bar has to
          hold it, six labelled destinations, the name and the way out. Six
          labelled destinations is the rule DESIGN.md actually protects ("a
          student who has to recognise six glyphs is a student who presses the
          wrong one"); the wordmark is the thing in that list nobody navigates
          by, on a screen where they already know which app they opened. So it
          is what yields, and it comes back at `xl` where the room exists.
        */}
        {/*
          The glyph, at every width. The wordmark does not come back.

          The bar is capped at 1100px and has to hold six labelled destinations,
          the account and the way out. The wordmark is 147px against the glyph's
          34px, and carrying it meant the only shrinkable thing in the row —
          the account name — gave up 113px to a logo, so "Signed in as"
          rendered as "Signed in…" on a 1440px screen. DESIGN.md restores the
          wordmark on desktop, but it is describing a 232px vertical rail with a
          theme switch in its footer, and neither has existed since the bar went
          horizontal.

          Six readable destination labels is the rule that section actually
          protects. This is what paying for them costs.
        */}
        <Logo size={34} />
      </a>

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
    /*
      A row at the end of the bar, not a column at the foot of a rail.

      This was written when navigation was a full-height rail down the left
      side, where stacking the name, the access date and the way out was the
      only option. The rail became a horizontal pill and this kept its
      `flex-col`, so three stacked items set the height of the whole bar — a
      72px pill rendering at about 150px, with the sign-out button pushing it
      the last stretch. The space was there to be used sideways.

      `ml-auto` pins it to the right end, away from the destinations, because it
      is not one of them.
    */
    // `min-w-0` here as well as on the name: a flex item will not shrink below
    // its content's width unless every ancestor in the chain says it may, and
    // this wrapper was the link that refused.
    <div className="ml-auto hidden min-w-0 items-center gap-2 pl-2 lg:flex">
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
      {/*
        Who you are. Two tight lines, and no third.

        The access date used to sit beside this as its own uppercase run —
        "ACCESS UNTIL AUG 17, 2027", about 180px — and between the two of them
        plus a 52px button the bar carried 1481px of content in a 1100px pill.
        It now lives on `/home` and on `/checkout`, which is where somebody goes
        to ask about it, and where this component's own tablet branch has always
        sent it: "a date does not fit at a readable size, and the answer to it
        does not fit is never to set it at 11px."

        This is the one thing in the bar allowed to shrink — `min-w-0` with a
        truncating name, rather than `shrink-0`. Everything else here is fixed
        text or a fixed control, so if the bar is ever too narrow the only
        graceful loser is the tail of a display name. Pinning this open instead
        was what put three pixels of overflow at exactly 1024, and a long handle
        would have put ninety.

        Both lines show at every desktop width now that the wordmark is not
        taking 113px out of this block. What a tester needed to see was *which
        account*, and the label above it is what makes the name unambiguous
        rather than decorative.
      */}
      {who === null ? null : (
        <span className="flex min-w-0 max-w-[11rem] flex-col leading-tight" data-signed-in-as="">
          <span className="text-caption text-ink-2 truncate">{c.nav.signedInAs}</span>
          <span className="text-label truncate">{who}</span>
        </span>
      )}
      {/*
        The way out, next to who you are (T-268).

        The only sign-out in the product was at the foot of the Access page,
        below the device list — a page you go to in order to pay. A tester
        looking for it could not find one and had to clear the session by hand,
        and a student on a shared phone has the same problem with higher stakes.

        Beside the name deliberately: "you are User C" and "stop being User C"
        are the same thought, and the name is what prompts it. Its weight — and
        why it is not `.btn-ghost` — lives in `SignOutButton`.
      */}
      {who === null ? null : <SignOutButton />}
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
