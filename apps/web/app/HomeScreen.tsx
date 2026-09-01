'use client';

/**
 * The front door.
 *
 * **This replaced the Phase 0 scaffold**, which was still shipping "Screens land
 * from Phase 4 onward" and a row of design-system probes — on a deployed
 * product, to anybody who opened the site. Every screen except `/practice` was
 * reachable only by typing its URL, so the whole product was effectively
 * invisible from its own home page.
 *
 * A hub, not a landing page. Somebody arriving here is a student with an exam
 * coming, not a prospect to be persuaded: the job is to get them to the thing
 * they came for in one tap, and to say plainly what each destination is.
 *
 * **Plain `<a>`, not a router push.** These are page transitions, they work
 * before the JavaScript arrives, and on a slow connection that difference is the
 * product working or not.
 */
import { useEffect, useState } from 'react';

import { Card } from '../components/Card';
import { SignOutButton } from '../components/SignOutButton';
import { api } from '../lib/api';
import { day } from '../lib/dates';
import { copy } from '../lib/i18n';

type Session =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | {
      kind: 'signedIn';
      activeUntil: string | null;
      /**
       * When a plan has run out, the day it ran out on.
       *
       * Null for somebody who has never paid. The two are different sentences
       * and this screen used to say the same one to both: a student whose
       * access had lapsed the previous day was told "You are on the free
       * questions", which is technically what they are now and says nothing
       * about what just happened to them. `/checkout` had the good version all
       * along — QA found the two screens disagreeing about the same account.
       */
      lapsedOn: string | null;
      /** A bank transfer waiting to be checked, so `/home` can say so. */
      pendingClaim: { txRef: string; amountEtb: number } | null;
      /** Free questions left. Null with no programme chosen. */
      freeRemaining: number | null;
      /**
       * Whether they have picked a programme yet (T-268).
       *
       * **`/home` was the one signed-in screen that did not ask.** Practise,
       * Mock and Ask all redirect to `/choose`; Home rendered the full hub of
       * five destinations, three of which immediately bounce. Since a fresh
       * sign-in lands here, the very first screen a new student saw was the one
       * that did not tell them what to do first.
       */
      needsProgramme: boolean;
    };

export function HomeScreen() {
  const c = copy();
  const [session, setSession] = useState<Session>({ kind: 'checking' });

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        // Both, together: the hub cannot say anything useful about a student
        // whose programme it does not know, and a second round trip after the
        // first has painted would move the page under them.
        const [me, fields] = await Promise.all([
          api.mySubscription(),
          api.myFields().catch(() => []),
        ]);
        if (live) {
          setSession({
            kind: 'signedIn',
            activeUntil: me.active ? me.expiresAt : null,
            lapsedOn: !me.active && me.hasEverPaid ? me.expiresAt : null,
            pendingClaim: me.pendingClaim,
            freeRemaining: me.freeRemaining,
            // An empty list means the request failed, and a student who has one
            // must not be nagged to choose because of a dropped connection.
            needsProgramme: fields.length > 0 && !fields.some((field) => field.chosen),
          });
        }
      } catch {
        // Any failure here means "not signed in as far as this screen is
        // concerned". It only decides which sentence to show — nothing is
        // gated on it, and the API refuses on its own regardless.
        if (live) setSession({ kind: 'signedOut' });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const destinations = [
    { href: '/practice', label: c.home.goPractice, why: c.home.goPracticeWhy },
    { href: '/exam', label: c.home.goExam, why: c.home.goExamWhy },
    { href: '/progress', label: c.home.goProgress, why: c.home.goProgressWhy },
    { href: '/standing', label: c.home.goStanding, why: c.home.goStandingWhy },
    { href: '/checkout', label: c.home.goCheckout, why: c.home.goCheckoutWhy },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">Lomi-Exams</h1>
        <p className="text-body text-ink-2">{c.home.tagline}</p>
      </header>

      {session.kind === 'signedOut' ? (
        <Card as="section" className="flex flex-col gap-3">
          <p className="text-body">{c.home.signedOut}</p>
          {/* Why, not just what. "Sign in with Telegram" reads as a hoop; the
              reason it is Telegram is a benefit worth one sentence. */}
          <p className="text-caption text-ink-2">{c.home.signedOutWhy}</p>
          {/* Somewhere to press. Telling somebody to open a bot they have not
              found yet, with no link to the screen that mints one, is the
              instruction this card used to end on. */}
          <a href="/signin" className="btn-primary">
            {c.signIn.continue}
          </a>
        </Card>
      ) : null}

      {/*
        What is true of THIS student, rather than of students in general.

        This was one line for everybody — "You are on the free questions" —
        shown identically to somebody two questions from the wall, somebody
        whose access lapsed yesterday, and somebody whose bank transfer was
        sitting unchecked in the admin queue. Every one of those facts existed
        and was already on `/checkout`; the page a student actually lands on
        knew none of them. QA read the same sentence on three different accounts
        and reported the home page as blind to who was looking at it.
      */}
      {/*
        The first thing to do, when nothing else on this page will work yet.

        Practise, Mock and Ask all redirect to `/choose`, so a student with no
        programme met three dead links before finding the one screen that
        unblocks them — on the page a fresh sign-in lands on. Shown above the
        access line because "you have 10 free questions" is not actionable until
        there is a programme to spend them in.
      */}
      {session.kind === 'signedIn' && session.needsProgramme ? (
        <Card as="section" className="flex flex-col gap-3" data-needs-programme="">
          <p className="text-body">{c.home.chooseFirst}</p>
          <p className="text-caption text-ink-2">{c.home.chooseFirstWhy}</p>
          <a href="/choose" className="btn-primary self-start">
            {c.home.chooseProgramme}
          </a>
        </Card>
      ) : null}

      {session.kind === 'signedIn' && !session.needsProgramme ? (
        <div className="flex flex-col gap-1">
          <p className="text-caption text-ink-2">
            {session.activeUntil
              ? c.home.accessUntil(day(session.activeUntil))
              : session.lapsedOn
                ? c.home.lapsedOn(day(session.lapsedOn))
                : session.freeRemaining !== null
                  ? c.home.freeLeft(session.freeRemaining)
                  : c.home.freeTier}
          </p>

          {/* The money they have already sent. Named by its reference, because
              that is what somebody quotes when they ask where it went. */}
          {session.pendingClaim !== null && (
            <p className="text-caption text-ink-2" data-pending-claim>
              {c.home.claimWaiting(session.pendingClaim.txRef)}
            </p>
          )}
        </div>
      ) : null}

      <nav className="flex flex-col gap-2">
        {destinations.map((destination) => (
          <a
            key={destination.href}
            href={destination.href}
            className="bg-surface-2 rounded-card flex flex-col gap-0.5 p-4"
          >
            <span className="text-body">{destination.label}</span>
            {/* What each one is, on the link itself. A menu of five bare nouns
                makes somebody guess, and a stressed student guesses wrong. */}
            <span className="text-caption text-ink-2">{destination.why}</span>
          </a>
        ))}
      </nav>

      {/*
        The way out, on a phone.

        The rail carries one from `lg` up, but the rail is desktop-only and the
        bottom bar has six destinations and no room for a seventh. That left the
        foot of the Access page — a page you open in order to pay — as the only
        sign-out in the product, which is where a tester failed to find it. This
        is the hub, so this is where it belongs.
      */}
      {session.kind === 'signedIn' ? <SignOutButton className="self-start lg:hidden" /> : null}
    </div>
  );
}
