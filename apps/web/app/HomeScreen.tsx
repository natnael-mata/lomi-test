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
    };

export function HomeScreen() {
  const c = copy();
  const [session, setSession] = useState<Session>({ kind: 'checking' });

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const me = await api.mySubscription();
        if (live) {
          setSession({
            kind: 'signedIn',
            activeUntil: me.active ? me.expiresAt : null,
            lapsedOn: !me.active && me.hasEverPaid ? me.expiresAt : null,
            pendingClaim: me.pendingClaim,
            freeRemaining: me.freeRemaining,
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
      {session.kind === 'signedIn' ? (
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
    </div>
  );
}
