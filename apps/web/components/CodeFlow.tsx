'use client';

/**
 * Number → code → password, for both sign-up and password reset (T-266).
 *
 * **One component, because they are one flow.** `HANDOFF.md` §12b specifies
 * sign-up and reset as the same three screens and says so explicitly: "Sign-up
 * reuses `Verify code` and `New password` unchanged — one flow to build, one to
 * test." Two copies would be two sets of limits, two sets of error states, and
 * an afternoon a year from now spent working out which one is wrong.
 *
 * What differs between them is exactly three sentences of copy and which
 * endpoint is called. Everything else — the countdown, the tries remaining, the
 * lockout clock, what happens on success — is identical by construction.
 *
 * **The states are the design.** A happy path through this is four taps and
 * needs no explaining; what a student actually meets is a code that arrived
 * late, a code they mistyped, a number they no longer have. Those are the
 * screens worth building carefully, and each is spelled out below.
 */
import { useCallback, useEffect, useState } from 'react';

import { AuthShell } from './AuthShell';
import { Button } from './Button';
import { Card } from './Card';
import { CodeInput } from './CodeInput';
import { Input } from './Input';
import { ApiError, api } from '../lib/api';
import { copy } from '../lib/i18n';

/** Which door this is. Only the copy and the endpoint differ. */
export type CodePurpose = 'register' | 'reset';

type Step =
  | { kind: 'phone' }
  /**
   * `sent` is whether a code actually went out just now (T-268).
   *
   * The screen said "We sent a six-digit code to 0963424628" unconditionally,
   * including when the server had refused with a 429 and sent nothing. The only
   * clue was the resend countdown reading something like 1103s, which is not a
   * thing anybody reads as "we lied on the line above". A student then waits
   * for an SMS that was never sent.
   */
  | { kind: 'code'; phone: string; expiresInSec: number; sent: boolean }
  | { kind: 'password'; phone: string; code: string };

/**
 * What the server said about a refused code.
 *
 * `triesLeft` and `retryAt` are both stated to the student. Somebody who does
 * not know how many guesses remain cannot decide whether to try again or ask
 * for a new code, so they try again — the behaviour the cap exists to stop. And
 * a lockout with no stated end is one they keep testing.
 */
interface Refusal {
  reason: string;
  triesLeft: number;
  retryAt: string | null;
  message: string;
}

export function CodeFlow({ purpose }: { purpose: CodePurpose }) {
  const c = copy();
  const words = purpose === 'register' ? c.codeFlow.signUp : c.codeFlow.reset;

  const [step, setStep] = useState<Step>({ kind: 'phone' });
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  /** Seconds until another code may be asked for. Counted down for display. */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  /** The server's own words when it has them, ours when it does not. */
  const explain = (e: unknown, fallback: string): void => {
    if (e instanceof ApiError) {
      const body = e.body as Partial<Refusal> | undefined;
      if (body?.reason) {
        setRefusal({
          reason: body.reason,
          triesLeft: body.triesLeft ?? 0,
          retryAt: body.retryAt ?? null,
          message: body.message ?? fallback,
        });
        setProblem(null);
        return;
      }
      setProblem(e.message || fallback);
      setRefusal(null);
      return;
    }
    setProblem(fallback);
    setRefusal(null);
  };

  const askForCode = useCallback(
    async (to: string): Promise<void> => {
      setBusy(true);
      setProblem(null);
      setRefusal(null);
      try {
        const sent = await api.requestCode(purpose, to);
        setStep({ kind: 'code', phone: to, expiresInSec: sent.expiresInSec, sent: true });
        setCooldown(RESEND_AFTER_SEC);
      } catch (e) {
        /*
         * A 429 here is the resend cooldown, and it carries the wait.
         *
         * Shown as a live countdown rather than a dead button: "wait" with no
         * number is indistinguishable from broken, and the student presses it
         * again, which is the traffic the cooldown was protecting against.
         */
        if (e instanceof ApiError && e.status === 429) {
          const wait = Number(
            (e.body as { retryAfterSec?: unknown } | undefined)?.retryAfterSec ?? RESEND_AFTER_SEC,
          );
          setCooldown(Number.isFinite(wait) ? wait : RESEND_AFTER_SEC);
          /*
           * `sent: false` on the way in **and** on a resend.
           *
           * This used to rewrite the step only when arriving from the phone
           * screen and leave it untouched otherwise — so pressing "Send another
           * code" and being refused restarted the countdown under a line still
           * reading "We sent a six-digit code to 0913…", with no error
           * anywhere. The student then waits for a message nobody dispatched.
           *
           * An earlier code may still be live, so they are not sent back to the
           * number screen; the screen simply stops claiming a new one is coming.
           */
          setStep((s) =>
            s.kind === 'code'
              ? { ...s, sent: false }
              : { kind: 'code', phone: to, expiresInSec: 600, sent: false },
          );
          setProblem(null);
          return;
        }
        explain(e, c.codeFlow.couldNotSend);
      } finally {
        setBusy(false);
      }
    },
    [purpose, c.codeFlow.couldNotSend],
  );

  /**
   * Leaves the code screen only if the code is good (T-268).
   *
   * **The screen that asks has to be the screen that refuses.** This step used
   * to be a plain `setStep` — no request at all — because the code and the
   * password were verified together at the end. So a mistyped code produced
   * nothing: no error, no counter, no network traffic, just the password screen.
   * The tries-remaining and the lockout clock were written, tested and
   * unreachable, and a tester reasonably concluded the code was never checked.
   *
   * The code is judged here and spent at the end, so a refusal lands on the
   * screen that caused it and the count means something while it still can.
   */
  const checkThenContinue = async (to: string): Promise<void> => {
    setBusy(true);
    setProblem(null);
    setRefusal(null);
    try {
      await api.checkCode(purpose, to, code);
      setStep({ kind: 'password', phone: to, code });
    } catch (e) {
      explain(e, c.codeFlow.couldNotVerify);
      // Cleared, because the next thing the student does is type it again and
      // six digits they have already been told are wrong are only in the way.
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const finish = async (): Promise<void> => {
    if (step.kind !== 'password') return;
    setBusy(true);
    setProblem(null);
    setRefusal(null);
    try {
      await api.verifyCode(purpose, step.phone, step.code, password);
      /*
       * Straight in. The server opened a session, because somebody who has just
       * proved they own the handset and chosen a password should not then be
       * asked to type that password on the very next screen.
       *
       * `/choose` for a new account — a student with no programme cannot
       * practise — and `/today` for a reset, where everything is already set up.
       */
      window.location.assign(purpose === 'register' ? '/choose' : '/today');
    } catch (e) {
      if (
        e instanceof ApiError &&
        (e.body as { error?: string } | undefined)?.error === 'WEAK_PASSWORD'
      ) {
        setProblem(c.codeFlow.weakPassword);
        setBusy(false);
        return;
      }
      // A refused code lands here rather than on the code step, because the
      // code is only spent when the password is submitted. Sent back a step so
      // the student can retype it.
      explain(e, c.codeFlow.couldNotVerify);
      setStep({ kind: 'code', phone: step.phone, expiresInSec: 600, sent: true });
      setBusy(false);
    }
  };

  /*
   * The heading changes with the step, the frame does not.
   *
   * It was one `<h1>` with one sentence under it for all three screens, so
   * "Create your account / Your phone number is your username" sat above a
   * six-digit code field and above a password field alike. The step is the one
   * thing a person in the middle of this needs to know, and it was the one
   * thing not said.
   */
  const heading =
    step.kind === 'phone'
      ? { title: words.title, subtitle: <>{words.intro}</>, n: 1 }
      : step.kind === 'code'
        ? {
            title: c.codeFlow.codeTitle,
            n: 2,
            subtitle: (
              <>
                {step.sent ? c.codeFlow.sentToShort(step.phone) : c.codeFlow.notSentYet(step.phone)}{' '}
                {/* The typo escape. Without it a wrong digit in the number is a
                    dead end: the code goes to a handset nobody is holding and
                    the only way back is the browser's own back button. */}
                <button
                  type="button"
                  className="text-link hover:text-link-hover font-semibold underline"
                  onClick={() => {
                    setStep({ kind: 'phone' });
                    setCode('');
                    setRefusal(null);
                    setProblem(null);
                  }}
                >
                  {c.codeFlow.changeNumber}
                </button>
              </>
            ),
          }
        : { title: words.passwordTitle, subtitle: <>{c.codeFlow.passwordHint}</>, n: 3 };

  return (
    <AuthShell
      // Back to sign-in, not to the landing page: both of these doors are
      // reached from there, and somebody who opened the wrong one wants the
      // other one, not the marketing.
      back="/signin"
      step={c.auth.step(heading.n, 3)}
      title={heading.title}
      subtitle={heading.subtitle}
    >
      {step.kind === 'phone' && (
        <section className="flex flex-col gap-4">
          <Input
            label={c.codeFlow.phoneLabel}
            hint={c.codeFlow.phoneHint}
            value={phone}
            inputMode="tel"
            autoComplete="tel"
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button
            disabled={busy || phone.trim().length < 9}
            onClick={() => void askForCode(phone.trim())}
          >
            {busy ? c.codeFlow.sending : c.codeFlow.sendCode}
          </Button>
        </section>
      )}

      {step.kind === 'code' && (
        <section className="flex flex-col gap-4">
          <CodeInput
            label={c.codeFlow.codeLabel}
            hint={c.codeFlow.codeHint}
            value={code}
            disabled={busy}
            onChange={setCode}
          />

          <Button
            disabled={busy || code.length !== 6}
            onClick={() => void checkThenContinue(step.phone)}
          >
            {busy ? c.codeFlow.checking : c.codeFlow.continue}
          </Button>

          {/*
            A live countdown, never a dead button.
            "Wait" with no number is indistinguishable from broken, and the
            student presses it again — which is the traffic this is protecting.

            A link now rather than a full-width ghost button: it was the same
            size and shape as Continue, directly beneath it, so the screen
            offered two equal buttons where only one is the way forward.
          */}
          <p className="text-ink-2 flex flex-wrap items-center justify-center gap-1 text-[15px]">
            {c.codeFlow.noCodeYet}
            {cooldown > 0 ? (
              <span className="num text-ink-3 inline-flex min-h-11 items-center px-1 font-semibold">
                {c.codeFlow.resendIn(cooldown)}
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="text-link hover:text-link-hover inline-flex min-h-11 items-center px-1 font-semibold disabled:opacity-60"
                onClick={() => void askForCode(step.phone)}
              >
                {c.codeFlow.resend}
              </button>
            )}
          </p>

          {/* The number they no longer have. Without this the flow is a wall. */}
          <p className="text-caption text-ink-3 text-center">{words.lostNumber}</p>
        </section>
      )}

      {step.kind === 'password' && (
        <section className="flex flex-col gap-4">
          <Input
            label={words.passwordLabel}
            value={password}
            type="password"
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button disabled={busy || password.length < 8} onClick={() => void finish()}>
            {busy ? c.codeFlow.saving : words.finish}
          </Button>
        </section>
      )}

      {/*
        What went wrong, in the server's own words.

        The tries remaining and the reopening time are both shown, and both are
        facts about counters and clocks rather than about the guess — nothing
        here tells anybody their digits were close.
      */}
      {refusal && (
        <Card as="section" className="flex flex-col gap-1" data-refusal={refusal.reason}>
          <p className="text-body text-wrong">{refusal.message}</p>
          {refusal.reason === 'wrong' && refusal.triesLeft > 0 && (
            <p className="text-caption text-ink-2">{c.codeFlow.triesLeft(refusal.triesLeft)}</p>
          )}
          {/*
            No second sentence about the time (T-268).

            This rendered "You can try again at 07:40 PM." directly under the
            server's own "This number is locked until 19:40." — one instant,
            twice, in two clock formats, one with a leading zero. At a glance it
            reads as two deadlines.

            The server's message names the time, in Addis, because the bot and
            anything else holding the API need it in the prose too. Formatting
            it a second time here in the browser's locale could only ever agree
            by accident. `retryAt` stays in the response for callers that would
            rather format it themselves.
          */}
          {/* Expiry is a rule, not a fault. The copy never implies the student
              broke something. */}
          {refusal.reason === 'expired' && (
            <p className="text-caption text-ink-2">{c.codeFlow.nothingWrong}</p>
          )}
        </Card>
      )}

      {problem && <p className="text-body text-wrong">{problem}</p>}
    </AuthShell>
  );
}

/** How long before "send another" is offered. Matches the server's cooldown. */
const RESEND_AFTER_SEC = 60;

/*
 * `clockTime` lived here and is gone.
 *
 * The design's rule — a lockout is stated as a time, "you can try again at
 * 14:32", never as "later" — has not changed. What changed is who says it: the
 * server's own refusal message now carries the time, so a second formatter in
 * the browser produced the same instant twice in two locales. See the refusal
 * card above.
 */
