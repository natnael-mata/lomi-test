'use client';

/**
 * Signing in (T-226, design handoff 2a and 2b).
 *
 * **The screen that was specified, built on the API side, and never drawn.**
 * `POST /auth/login-link` has existed for weeks; the only way into the product
 * was the testing door at `/dev-login`.
 *
 * There is no password field here and there never will be. The flow is:
 *
 * 1. Mint a request. The server returns a deep link, a pairing code, and a
 *    `pollSecret` that **stays in this browser**.
 * 2. The student taps the link. Telegram opens, the bot asks them to confirm,
 *    and its prompt carries the same pairing code this page is showing.
 * 3. This page polls `claim` with the secret. The bot's approval is what turns
 *    the request into a session; the secret is what proves the session belongs
 *    to *this* browser rather than to whoever knows the nonce.
 *
 * **Nothing secret is ever typed here.** The code is shown so the student can
 * check it against the bot's prompt before approving — see the note on
 * `Pairing` for why that is the defence rather than the decoration, and for
 * where the design handoff describes this backwards.
 *
 * Nothing here is behind a "sign up" tab, because there is no sign-up: pressing
 * Start in Telegram creates the account and signs in with the same tap.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Card } from '../../components/Card';
import { Icon } from '../../components/icons';
import { Logo } from '../../components/Logo';
import { ApiError, api, type LoginLink } from '../../lib/api';
import { copy } from '../../lib/i18n';

/** How often the page asks whether the student has confirmed. */
const POLL_MS = 2_500;

type Phase =
  | { kind: 'starting' }
  | { kind: 'waiting'; link: LoginLink }
  | { kind: 'signedIn' }
  | { kind: 'error'; message: string };

export function SignInScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [remaining, setRemaining] = useState<number>(0);

  const start = useCallback(async (): Promise<void> => {
    setPhase({ kind: 'starting' });
    try {
      // A label the student would recognise in their own device list, not a
      // fingerprint: the point is "is this the laptop I am sitting at", and a
      // user agent string answers a different question badly.
      const link = await api.createLoginLink(deviceLabel());
      setPhase({ kind: 'waiting', link });
    } catch (error) {
      const missing = error instanceof ApiError && error.code === 'BOT_NOT_CONFIGURED';
      setPhase({
        kind: 'error',
        message: missing ? c.signIn.notConfigured : c.signIn.couldNotStart,
      });
    }
  }, [c.signIn.couldNotStart, c.signIn.notConfigured]);

  useEffect(() => {
    void start();
  }, [start]);

  /**
   * The secret, held where a re-render cannot lose it and a poll can read it.
   *
   * Not in `localStorage`, deliberately. It is worth a session for as long as
   * the request is live, and a shared or library computer is exactly where this
   * screen gets used.
   */
  const live = useRef<LoginLink | null>(null);
  live.current = phase.kind === 'waiting' ? phase.link : null;

  useEffect(() => {
    if (phase.kind !== 'waiting') return;
    const timer = setInterval(() => {
      void (async () => {
        const link = live.current;
        if (link === null) return;
        try {
          const result = await api.claimLoginLink(link.nonce, link.pollSecret, deviceLabel());
          if ('userId' in result) {
            setPhase({ kind: 'signedIn' });
            // A full navigation rather than a router push: the session arrived
            // as a `Set-Cookie` on that response, and every screen behind it is
            // rendered against a session the client router has not seen.
            window.location.assign('/practice');
          }
        } catch {
          // A failed poll is not a failed sign-in — a dropped packet on a
          // student's connection is the ordinary case, and giving up on it
          // would strand somebody who has already pressed Start.
        }
      })();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [phase.kind]);

  /** The countdown beside the code. Ticks locally; the server owns the truth. */
  useEffect(() => {
    if (phase.kind !== 'waiting') return;
    const endsAt = new Date(phase.link.expiresAt).getTime();
    const tick = (): void => setRemaining(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [phase]);

  return (
    <div className="flex min-h-dvh flex-col justify-center gap-4 py-6">
      <div className="mb-1 flex flex-col items-center gap-3">
        <Logo size={56} />
        <h1 className="text-title text-center">{c.signIn.valueTitle}</h1>
        <p className="text-body text-ink-2 text-center">{c.signIn.valueBody}</p>
      </div>

      {/* The whole onboarding story, in three lines. Registration, email
          verification and password reset do not exist in this product, so the
          screen does not hint that they might. */}
      <Card as="section" className="flex flex-col gap-3">
        {[c.signIn.step1, c.signIn.step2, c.signIn.step3].map((step, index) => (
          <p key={step} className="text-body flex items-start gap-3">
            <span className="option-key">{index + 1}</span>
            <span className="flex-1">{step}</span>
          </p>
        ))}
      </Card>

      {phase.kind === 'error' ? (
        <Card as="section" className="flex flex-col gap-3">
          <p className="text-body">{phase.message}</p>
          <button type="button" className="btn-ghost" onClick={() => void start()}>
            {c.common.tryAgain}
          </button>
        </Card>
      ) : null}

      {phase.kind === 'starting' ? (
        <p className="text-body text-ink-2 text-center">{c.signIn.starting}</p>
      ) : null}

      {phase.kind === 'signedIn' ? (
        <p className="text-body text-center">{c.signIn.signedIn}</p>
      ) : null}

      {phase.kind === 'waiting' ? (
        <Pairing link={phase.link} remaining={remaining} onRenew={() => void start()} />
      ) : null}

      <p className="text-caption text-ink-2 text-center">{c.signIn.coverage}</p>
    </div>
  );
}

/**
 * The link, the code, and the wait.
 *
 * **The code is a confirmation code, not a secret** — and the design handoff
 * has this backwards. It draws the code as something the student sends *to* the
 * bot from a second phone, which would be a different mechanism from the one
 * `login-link.service.ts` implements: the server puts the same three digits in
 * the bot's approval prompt, and the student's job is to check the two match
 * before pressing approve. Nothing is typed anywhere.
 *
 * That is worth keeping rather than "fixing" to match the drawing. It is what
 * defends the one attack this flow has: a stranger mints a request and hopes
 * somebody taps approve out of habit. A code that has to *match* makes the
 * mismatched prompt visibly not yours.
 *
 * The consequence is that the handoff's "Telegram on another phone?" case is
 * not solved here — that needs the bot to accept a typed code, which it does
 * not do. Better to say what the product does than to print an instruction that
 * silently fails.
 *
 * The waiting line is Pending amber with an icon and words — never a bare
 * spinner, which says "something is happening" and nothing about what.
 */
function Pairing({
  link,
  remaining,
  onRenew,
}: {
  link: LoginLink;
  remaining: number;
  onRenew: () => void;
}) {
  const c = copy();

  return (
    <Card as="section" className="flex flex-col gap-4 p-5 sm:p-8">
      <h2 className="text-title text-center">{c.signIn.title}</h2>
      <p className="text-body text-ink-2 text-center">{c.signIn.intro}</p>

      <a href={link.deepLink} className="btn-primary">
        <Icon name="telegram" size={20} />
        {c.signIn.open}
      </a>

      <span className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-caption text-ink-2 uppercase">{c.signIn.beforeYouApprove}</span>
        <span className="bg-border h-px flex-1" />
      </span>

      <p className="text-body text-ink-2 text-center">{c.signIn.checkCode(botHandle(link))}</p>

      {/* Grouped in threes and widely tracked, because this is compared against
          a second screen by somebody looking back and forth. */}
      <p className="bg-surface-2 rounded-control text-display num py-4 text-center tracking-[0.12em]">
        {spaced(link.pairingCode)}
      </p>

      <p
        className="text-pending text-label flex items-center justify-center gap-2 text-center"
        aria-live="polite"
      >
        <Icon name="clock" size={16} />
        {c.signIn.waiting}
      </p>

      {/* The countdown and the way out of it, on one line. The button is set to
          44px rather than to its text height: it is the only escape from an
          expired code, and an 18px tap target is one a thumb misses. */}
      <p className="text-caption text-ink-2 num flex flex-wrap items-center justify-center gap-1 text-center">
        {c.signIn.expiresIn(clock(remaining))}
        <button
          type="button"
          className="text-brand rounded-control inline-flex min-h-11 items-center px-2 font-semibold"
          onClick={onRenew}
        >
          {c.signIn.newCode}
        </button>
      </p>
    </Card>
  );
}

/** `738264` → `738 264`. Three-digit groups, the way a person reads them aloud. */
function spaced(code: string): string {
  return code.replace(/(\d{3})(?=\d)/g, '$1 ');
}

/** m:ss. Tabular figures, so the last digit does not shuffle the line every second. */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The bot's handle, taken out of the deep link the server built.
 *
 * Read from the link rather than configured again in the browser: two places
 * naming the bot is two places to get it wrong, and the one on this screen is
 * the one a student types into Telegram's search box.
 */
function botHandle(link: LoginLink): string {
  const match = /t\.me\/([A-Za-z0-9_]+)/.exec(link.deepLink);
  return match ? `@${match[1]}` : '';
}

/**
 * What this device will be called in the student's device list.
 *
 * Deliberately coarse. "Chrome on Windows" is what somebody can recognise as
 * the machine they are sitting at; a full user agent is unreadable and also
 * more than the product needs to know.
 */
function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Safari\//.test(ua)
        ? 'Safari'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : 'Browser';
  const platform = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS/.test(ua)
          ? 'Mac'
          : 'Linux';
  return `${browser} on ${platform}`;
}
