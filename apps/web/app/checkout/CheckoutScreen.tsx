'use client';

/**
 * Checkout (T-142, T-145, T-154).
 *
 * A plan, then one of four ways to pay, then a wait. The four are laid out
 * flat rather than behind a "more payment methods" disclosure: on a phone in
 * Ethiopia the right one depends on which wallet the student's family uses, and
 * hiding three of them behind a tap makes that choice look like an edge case.
 *
 * **The order is deliberate.** telebirr first because it is the one most
 * students have; the bank transfer last because it is the slowest — it is
 * settled by a person reading a statement — but present, because it is the only
 * one that works when the wallets are down, which they are, sometimes.
 *
 * Nothing on this screen decides whether a payment succeeded. The server does,
 * and only after asking Chapa directly; this polls and reports.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { ApiError, api, type PlanCode, type PlanOffer } from '../../lib/api';
import { copy } from '../../lib/i18n';

type Method = 'telebirr' | 'cbebirr' | 'chapa' | 'bank';

type Phase =
  | { kind: 'loading' }
  | { kind: 'choosing' }
  | { kind: 'redirecting' }
  /** A push is on its way to a handset, or the student has come back from Chapa. */
  | { kind: 'waiting'; txRef: string; mobile: string | null; slow: boolean }
  | { kind: 'confirmed'; expiresAt: string | null }
  | { kind: 'submitted'; txRef: string }
  | { kind: 'error'; message: string };

/** How often the waiting screen asks. */
const POLL_MS = 3_000;
/** After this long, say so rather than spinning silently. */
const SLOW_AFTER_MS = 45_000;

export function CheckoutScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [plans, setPlans] = useState<PlanOffer[]>([]);
  const [planCode, setPlanCode] = useState<PlanCode>('TWELVE_MONTH');
  const [method, setMethod] = useState<Method>('telebirr');
  const [mobile, setMobile] = useState('');
  const [txRef, setTxRef] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const offers = await api.plans();
        if (!live) return;
        setPlans(offers);
        // Pre-select the best value rather than the cheapest sticker price —
        // the same order the picker leads with, so the highlighted card and the
        // selected one agree.
        setPlanCode(offers.find((o) => o.bestValue)?.code ?? offers[0]?.code ?? 'TWELVE_MONTH');
        setPhase({ kind: 'choosing' });
      } catch {
        if (live) setPhase({ kind: 'error', message: c.checkout.couldNotStart });
      }
    })();
    return () => {
      live = false;
    };
  }, [c.checkout.couldNotStart]);

  const waitingRef = useRef<string | null>(null);
  waitingRef.current = phase.kind === 'waiting' ? phase.txRef : null;

  /**
   * Polls while a charge is outstanding.
   *
   * The webhook and this race each other, and either can win — a webhook that
   * was never delivered, because a callback URL was wrong all along, must not
   * leave somebody staring at a spinner over money that has left their account.
   */
  useEffect(() => {
    if (phase.kind !== 'waiting') return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      void (async () => {
        const ref = waitingRef.current;
        if (ref === null) return;
        try {
          const status = await api.paymentStatus(ref);
          if (status.status === 'CONFIRMED') {
            setPhase({ kind: 'confirmed', expiresAt: status.expiresAt });
            return;
          }
        } catch {
          // A failed poll is not a failed payment. Keep asking.
        }
        if (Date.now() - startedAt > SLOW_AFTER_MS) {
          setPhase((p) => (p.kind === 'waiting' && !p.slow ? { ...p, slow: true } : p));
        }
      })();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [phase.kind]);

  const fail = useCallback(
    (error: unknown): void => {
      if (error instanceof ApiError) {
        if (error.code === 'MOBILE_INVALID') {
          setFieldError(c.checkout.mobileInvalid);
          return;
        }
        if (error.code === 'TX_REF_REQUIRED') {
          setFieldError(c.checkout.txRefRequired);
          return;
        }
        if (error.code === 'TX_REF_ALREADY_SUBMITTED') {
          setFieldError(c.checkout.txRefTaken);
          return;
        }
        if (error.code === 'CHAPA_NOT_CONFIGURED' || error.status === 503) {
          // Names the way out rather than only the fault: the bank transfer is
          // on the same screen and does not depend on the provider being up.
          setPhase({ kind: 'error', message: c.checkout.unavailable });
          return;
        }
      }
      setPhase({ kind: 'error', message: c.checkout.couldNotStart });
    },
    [c.checkout],
  );

  const pay = useCallback(async (): Promise<void> => {
    setFieldError(null);
    setBusy(true);
    try {
      if (method === 'telebirr' || method === 'cbebirr') {
        const started = await api.payDirect(method, planCode, mobile);
        setPhase({
          kind: 'waiting',
          txRef: started.txRef,
          mobile: started.pushSentTo,
          slow: false,
        });
        return;
      }
      if (method === 'chapa') {
        const started = await api.payHosted(planCode);
        setPhase({ kind: 'redirecting' });
        // Chapa's page, not ours. A full navigation rather than a new tab: a
        // popup blocker eating the checkout is indistinguishable from nothing
        // happening.
        window.location.assign(started.checkoutUrl);
        return;
      }
      const started = await api.payManual(planCode, txRef);
      setPhase({ kind: 'submitted', txRef: txRef.trim() });
      void started;
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }, [fail, method, mobile, planCode, txRef]);

  if (phase.kind === 'loading') return <p className="text-body text-ink-2">{c.checkout.working}</p>;

  if (phase.kind === 'redirecting') {
    return <p className="text-body text-ink-2">{c.checkout.openingChapa}</p>;
  }

  if (phase.kind === 'error') {
    return (
      <Card as="section" className="flex flex-col gap-3">
        <p className="text-body">{phase.message}</p>
        <Button onClick={() => setPhase({ kind: 'choosing' })}>{c.common.tryAgain}</Button>
      </Card>
    );
  }

  if (phase.kind === 'confirmed') {
    return (
      <Card as="section" className="flex flex-col gap-2">
        <h1 className="text-title">{c.checkout.confirmed}</h1>
        {phase.expiresAt ? (
          <p className="text-body text-ink-2">
            {c.checkout.accessUntil(new Date(phase.expiresAt).toLocaleDateString())}
          </p>
        ) : null}
      </Card>
    );
  }

  if (phase.kind === 'waiting') {
    return (
      <Card as="section" className="flex flex-col gap-3" aria-live="polite">
        <p className="text-body">
          {phase.mobile ? c.checkout.checkYourPhone(phase.mobile) : c.checkout.openingChapa}
        </p>
        {phase.slow ? <p className="text-body text-ink-2">{c.checkout.stillWaiting}</p> : null}
        <p className="text-caption text-ink-2">{c.checkout.yourReference(phase.txRef)}</p>
      </Card>
    );
  }

  if (phase.kind === 'submitted') {
    return (
      <Card as="section" className="flex flex-col gap-2">
        <p className="text-body">{c.checkout.manualPending}</p>
        {/* T-154: the reference is on the screen, not only in an email. */}
        <p className="text-caption text-ink-2">{c.checkout.yourReference(phase.txRef)}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">{c.checkout.title}</h1>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-caption text-ink-2 uppercase">{c.checkout.title}</legend>
        {plans.map((plan) => (
          <label
            key={plan.code}
            className="bg-surface-2 rounded-card flex items-center gap-3 p-3"
            data-selected={plan.code === planCode}
          >
            <input
              type="radio"
              name="plan"
              value={plan.code}
              checked={plan.code === planCode}
              onChange={() => setPlanCode(plan.code)}
            />
            <span className="flex flex-col">
              <span className="text-body">{c.checkout.perMonth(plan.perMonthEtb)}</span>
              <span className="text-caption text-ink-2">
                {c.checkout.forMonths(plan.priceEtb, plan.months)}
                {plan.bestValue ? ` · ${c.checkout.bestValue}` : ''}
                {plan.savingPct > 0 ? ` · ${c.checkout.savingVs(plan.savingPct)}` : ''}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-caption text-ink-2 uppercase">{c.checkout.howToPay}</legend>
        {(
          [
            ['telebirr', c.checkout.telebirr, c.checkout.telebirrHow],
            ['cbebirr', c.checkout.cbebirr, c.checkout.cbebirrHow],
            ['chapa', c.checkout.chapa, c.checkout.chapaHow],
            ['bank', c.checkout.bank, c.checkout.bankHow],
          ] as const
        ).map(([value, label, how]) => (
          <label
            key={value}
            className="bg-surface-2 rounded-card flex items-start gap-3 p-3"
            data-selected={value === method}
          >
            <input
              type="radio"
              name="method"
              value={value}
              checked={value === method}
              onChange={() => {
                setMethod(value);
                setFieldError(null);
              }}
            />
            <span className="flex flex-col">
              <span className="text-body">{label}</span>
              {/* What actually happens next, on the option itself. A student
                  choosing between four wallets should not have to press one to
                  find out whether it opens a page or rings their phone. */}
              <span className="text-caption text-ink-2">{how}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {method === 'telebirr' || method === 'cbebirr' ? (
        <Input
          label={c.checkout.mobileLabel}
          hint={c.checkout.mobileHint}
          error={fieldError ?? undefined}
          inputMode="tel"
          autoComplete="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
        />
      ) : null}

      {method === 'bank' ? (
        <Input
          label={c.checkout.txRefLabel}
          hint={c.checkout.txRefHint}
          error={fieldError ?? undefined}
          value={txRef}
          onChange={(e) => setTxRef(e.target.value)}
        />
      ) : null}

      <Button onClick={() => void pay()} disabled={busy}>
        {busy ? c.checkout.sending : c.checkout.pay}
      </Button>
    </div>
  );
}
