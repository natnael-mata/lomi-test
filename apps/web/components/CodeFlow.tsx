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

import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { ApiError, api } from '../lib/api';
import { copy } from '../lib/i18n';

/** Which door this is. Only the copy and the endpoint differ. */
export type CodePurpose = 'register' | 'reset';

type Step =
  | { kind: 'phone' }
  | { kind: 'code'; phone: string; expiresInSec: number }
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
        setStep({ kind: 'code', phone: to, expiresInSec: sent.expiresInSec });
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
          setStep((s) => (s.kind === 'phone' ? { kind: 'code', phone: to, expiresInSec: 600 } : s));
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
       * practise — and `/home` for a reset, where everything is already set up.
       */
      window.location.assign(purpose === 'register' ? '/choose' : '/home');
    } catch (e) {
      if (e instanceof ApiError && (e.body as { error?: string } | undefined)?.error === 'WEAK_PASSWORD') {
        setProblem(c.codeFlow.weakPassword);
        setBusy(false);
        return;
      }
      // A refused code lands here rather than on the code step, because the
      // code is only spent when the password is submitted. Sent back a step so
      // the student can retype it.
      explain(e, c.codeFlow.couldNotVerify);
      setStep({ kind: 'code', phone: step.phone, expiresInSec: 600 });
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">{words.title}</h1>
        <p className="text-body text-ink-2">{words.intro}</p>
      </header>

      {step.kind === 'phone' && (
        <Card as="section" className="flex flex-col gap-3">
          <Input
            label={c.codeFlow.phoneLabel}
            hint={c.codeFlow.phoneHint}
            value={phone}
            inputMode="tel"
            autoComplete="tel"
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button disabled={busy || phone.trim().length < 9} onClick={() => void askForCode(phone.trim())}>
            {busy ? c.codeFlow.sending : c.codeFlow.sendCode}
          </Button>
        </Card>
      )}

      {step.kind === 'code' && (
        <Card as="section" className="flex flex-col gap-3">
          <p className="text-body">{c.codeFlow.sentTo(step.phone)}</p>
          <Input
            label={c.codeFlow.codeLabel}
            hint={c.codeFlow.codeHint}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />

          <Button
            disabled={busy || code.length !== 6}
            onClick={() => setStep({ kind: 'password', phone: step.phone, code })}
          >
            {c.codeFlow.continue}
          </Button>

          {/*
            A live countdown, never a dead button.
            "Wait" with no number is indistinguishable from broken, and the
            student presses it again — which is the traffic this is protecting.
          */}
          <Button
            variant="ghost"
            disabled={busy || cooldown > 0}
            onClick={() => void askForCode(step.phone)}
          >
            {cooldown > 0 ? c.codeFlow.resendIn(cooldown) : c.codeFlow.resend}
          </Button>

          {/* The number they no longer have. Without this the flow is a wall. */}
          <p className="text-caption text-ink-2">{words.lostNumber}</p>
        </Card>
      )}

      {step.kind === 'password' && (
        <Card as="section" className="flex flex-col gap-3">
          <Input
            label={words.passwordLabel}
            hint={c.codeFlow.passwordHint}
            value={password}
            type="password"
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button disabled={busy || password.length < 8} onClick={() => void finish()}>
            {busy ? c.codeFlow.saving : words.finish}
          </Button>
        </Card>
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
          {refusal.retryAt && (
            <p className="text-caption text-ink-2">{c.codeFlow.tryAgainAt(clockTime(refusal.retryAt))}</p>
          )}
          {/* Expiry is a rule, not a fault. The copy never implies the student
              broke something. */}
          {refusal.reason === 'expired' && (
            <p className="text-caption text-ink-2">{c.codeFlow.nothingWrong}</p>
          )}
        </Card>
      )}

      {problem && <p className="text-body text-wrong">{problem}</p>}
    </div>
  );
}

/** How long before "send another" is offered. Matches the server's cooldown. */
const RESEND_AFTER_SEC = 60;

/**
 * A wall-clock time, in the reader's own timezone.
 *
 * The design is emphatic that a lockout is stated as a time — "you can try
 * again at 14:32" — never as a duration. A duration has to be added to a clock
 * the student is already looking at, and "later" is not an answer at all.
 */
function clockTime(iso: string): string {
  const when = new Date(iso);
  return Number.isNaN(when.getTime())
    ? ''
    : when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
