'use client';

/**
 * Checkout (T-142, T-145, T-154 — design handoff 2c, 2d, 2e, 2f).
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
 * The screen is a small stack of steps rather than one long form: choosing a
 * method opens *that* method's screen, with a back chevron, because the fields
 * telebirr needs and the fields a bank transfer needs have nothing to do with
 * each other and showing both at once asks a student to work out which half is
 * theirs.
 *
 * **Nothing here decides whether a payment succeeded.** The server does, and
 * only after asking Chapa directly; this polls and reports. That is why the
 * slow state says "nothing has been charged yet" rather than guessing.
 *
 * A student who already has access lands on the receipt instead (2f) — the
 * Access tab is where somebody goes both to buy and to prove they bought.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/icons';
import { Input } from '../../components/Input';
import { Receipt } from '../../components/Receipt';
import { ApiError, api, signInRequired, type PlanCode, type PlanOffer } from '../../lib/api';
import { copy } from '../../lib/i18n';
import { day } from '../../lib/dates';

type Method = 'telebirr' | 'cbebirr' | 'chapa' | 'bank';

type Phase =
  | { kind: 'loading' }
  /** Already paid: the receipt, not the picker. */
  | { kind: 'subscribed' }
  /**
   * Plans, the way to pay, and the summary with the one button, on one page
   * (redesign). The method used to be its own phase, a second screen reached
   * by tapping a method; now it is a choice on this one, and its fields (the
   * paying number, or the bank and the reference) sit in the summary.
   */
  | { kind: 'choosing' }
  | { kind: 'redirecting' }
  /** A push is on its way to a handset, or the student has come back from Chapa. */
  | { kind: 'waiting'; txRef: string; mobile: string | null; slow: boolean; method: Method }
  | { kind: 'confirmed'; expiresAt: string | null }
  | { kind: 'submitted'; txRef: string; plan: PlanOffer | null }
  | { kind: 'error'; message: string };

/** How often the waiting screen asks. */
const POLL_MS = 3_000;
/** After this long, say so rather than spinning silently. */
const SLOW_AFTER_MS = 45_000;

/**
 * The account a bank transfer goes to.
 *
 * From the environment, and **not rendered at all when unset**. Inventing a
 * plausible account number for a screen that tells somebody where to send money
 * is the one mistake on this screen that costs a student real birr.
 */
const BANK_ACCOUNT = process.env.NEXT_PUBLIC_BANK_ACCOUNT ?? '';

const METHOD_ICON: Record<Method, IconName> = {
  telebirr: 'phone',
  cbebirr: 'phone',
  chapa: 'card',
  bank: 'bank',
};

export function CheckoutScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [plans, setPlans] = useState<PlanOffer[]>([]);
  const [planCode, setPlanCode] = useState<PlanCode>('TWELVE_MONTH');
  const [method, setMethod] = useState<Method>('telebirr');
  /** The programme being paid for, for the heading and the summary line. */
  const [fieldName, setFieldName] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  /** Set when the number came from Telegram rather than from the keyboard. */
  const [verifiedPhone, setVerifiedPhone] = useState(false);
  const [txRef, setTxRef] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  /** A method that cannot be used here, said beside the button that tried it. */
  const [methodError, setMethodError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Counts up while a push is outstanding, so the wait is a number not a mood. */
  const [waited, setWaited] = useState(0);
  /**
   * A claim already with the team, if there is one.
   *
   * **This screen used to show nothing about it.** A student who submitted a
   * bank transfer saw the confirmation once and then, on every later visit, the
   * plan picker again — with no way to tell whether the claim had arrived. The
   * obvious next move is to pay a second time.
   */
  const [pending, setPending] = useState<{ txRef: string; amountEtb: number } | null>(null);
  /** Set when they paid before and it has run out — a renewal, not a first sale. */
  const [lapsedOn, setLapsedOn] = useState<string | null>(null);
  /** Free questions left, for the line about waiting. Null when unknown. */
  const [freeLeft, setFreeLeft] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [offers, subscription, contact, history, fields] = await Promise.all([
          api.plans(),
          api.mySubscription().catch(() => null),
          // Never fatal: a checkout that refuses to open because a convenience
          // lookup failed is a checkout that refuses money.
          api.myContact().catch(() => null),
          api.paymentHistory().catch(() => null),
          api.myFields().catch(() => []),
        ]);
        if (!alive) return;
        setPlans(offers);
        setFreeLeft(subscription?.freeRemaining ?? null);
        setFieldName(fields.find((f) => f.chosen)?.name ?? null);

        const waiting = history?.payments.find((p) => p.status === 'PENDING') ?? null;
        setPending(waiting ? { txRef: waiting.txRef, amountEtb: waiting.amountEtb } : null);
        if (contact?.phone && contact.verifiedAt) {
          setMobile(contact.phone);
          setVerifiedPhone(true);
        }
        // Pre-select the best value rather than the cheapest sticker price —
        // the same order the picker leads with, so the highlighted card and the
        // selected one agree.
        setPlanCode(offers.find((o) => o.bestValue)?.code ?? offers[0]?.code ?? 'TWELVE_MONTH');
        // Paid before, and it ran out. Not the same student as one who never
        // paid, and not the same offer.
        if (subscription && !subscription.active && subscription.hasEverPaid) {
          setLapsedOn(subscription.expiresAt);
        }
        setPhase(subscription?.active ? { kind: 'subscribed' } : { kind: 'choosing' });
      } catch (e) {
        if (signInRequired(e)) {
          window.location.assign('/signin');
          return;
        }
        if (alive) setPhase({ kind: 'error', message: c.checkout.couldNotStart });
      }
    })();
    return () => {
      alive = false;
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
    setWaited(0);
    const timer = setInterval(() => {
      setWaited(Math.round((Date.now() - startedAt) / 1000));
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
    (error: unknown, method: Method): void => {
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
          // In place, under the button: the form stays, so the bank transfer
          // it recommends is still on screen to choose.
          setMethodError(c.checkout.unavailable(c.checkout[method], BANK_ACCOUNT !== ''));
          return;
        }
      }
      setPhase({ kind: 'error', message: c.checkout.couldNotStart });
    },
    [c.checkout],
  );

  const pay = useCallback(
    async (method: Method): Promise<void> => {
      setFieldError(null);
      setMethodError(null);
      setBusy(true);
      try {
        if (method === 'telebirr' || method === 'cbebirr') {
          const started = await api.payDirect(method, planCode, mobile);
          setPhase({
            kind: 'waiting',
            txRef: started.txRef,
            mobile: started.pushSentTo,
            slow: false,
            method,
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
        await api.payManual(planCode, txRef);
        setPhase({
          kind: 'submitted',
          txRef: txRef.trim(),
          plan: plans.find((p) => p.code === planCode) ?? null,
        });
      } catch (error) {
        fail(error, method);
      } finally {
        setBusy(false);
      }
    },
    [fail, mobile, planCode, plans, txRef],
  );

  const plan = plans.find((p) => p.code === planCode) ?? null;

  if (phase.kind === 'loading') return <p className="text-body text-ink-2">{c.checkout.working}</p>;
  if (phase.kind === 'subscribed') return <Receipt />;

  if (phase.kind === 'redirecting') {
    return <p className="text-body text-ink-2">{c.checkout.openingChapa}</p>;
  }

  if (phase.kind === 'error') {
    return (
      <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-6">
        <p className="text-body">{phase.message}</p>
        <Button onClick={() => setPhase({ kind: 'choosing' })}>{c.common.tryAgain}</Button>
      </section>
    );
  }

  if (phase.kind === 'confirmed') {
    return (
      <div className="flex flex-col gap-4">
        <Banner tone="correct" icon="check">
          {c.checkout.verifiedBanner}
        </Banner>
        <Receipt />
      </div>
    );
  }

  if (phase.kind === 'waiting') {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <Heading onBack={() => setPhase({ kind: 'choosing' })}>{c.checkout[phase.method]}</Heading>

        <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-6">
          {plan ? <OrderLine plan={plan} /> : null}
          <span className="bg-border h-px" />
          <Banner tone="pending" icon="clock">
            {c.checkout.waitingBanner}
          </Banner>
          <p className="text-body">
            {phase.mobile
              ? c.checkout.requestSentTo(c.checkout[phase.method], phase.mobile)
              : c.checkout.openingChapa}
          </p>
          <p className="text-caption text-ink-2 num">{c.checkout.waitingFor(mmss(waited))}</p>
          {/* The reference, now, before anything can go wrong: it is what a
              student quotes to support if the request never arrives. */}
          <p className="text-caption text-ink-2">{c.checkout.yourReference(phase.txRef)}</p>
        </section>

        {phase.slow ? (
          <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-6">
            <Banner tone="pending" icon="clock">
              {c.checkout.slowBanner}
            </Banner>
            <p className="text-body">{c.checkout.slowBody}</p>
            {/* A fresh request is a fresh reference. The old one may still
                arrive and settle; the server dedupes on the reference. */}
            <Button variant="ghost" onClick={() => void pay(phase.method)} disabled={busy}>
              {c.checkout.sendAgain}
            </Button>
            <Button variant="ghost" onClick={() => setPhase({ kind: 'choosing' })}>
              {c.checkout.payDifferently}
            </Button>
          </section>
        ) : null}
      </div>
    );
  }

  if (phase.kind === 'submitted') {
    return (
      <div className="flex flex-col gap-4">
        <Heading onBack={() => setPhase({ kind: 'choosing' })}>{c.checkout.bank}</Heading>
        <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-6">
          {/* Pending, not confirmed: nothing is granted until a person has
              matched the transfer against the bank statement. */}
          <Banner tone="pending" icon="clock">
            {c.checkout.submittedBanner}
          </Banner>
          {/* What was claimed, restated: the plan and the amount the team will
              look for on the statement. */}
          {phase.plan ? <OrderLine plan={phase.plan} /> : null}
          <p className="text-body">{c.checkout.submittedBody(phase.txRef, freeLeft)}</p>
          <p className="text-caption text-ink-2">{c.checkout.yourReference(phase.txRef)}</p>
          {/* A way on. Without it the only control was Back, into the form
              that had just been sent. */}
          <a href="/today" className="btn-primary self-start">
            {c.checkout.backToToday}
          </a>
        </section>
      </div>
    );
  }

  /*
   * Choosing: the handoff's one page. The plans, then the way to pay beside
   * the summary, whose button says the amount and the method in words, so
   * there is nothing between pressing it and knowing what it does.
   */
  const direct = method === 'telebirr' || method === 'cbebirr';
  const price = c.paywall.price(plan?.priceEtb ?? 0);
  const METHODS = [
    ['telebirr', c.checkout.telebirr, c.checkout.telebirrHow],
    ['cbebirr', c.checkout.cbebirr, c.checkout.cbebirrHow],
    ['chapa', c.checkout.chapa, c.checkout.chapaHow],
    ['bank', c.checkout.bank, c.checkout.bankHow],
  ] as const;
  const methodName = METHODS.find(([value]) => value === method)?.[1] ?? '';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-[clamp(26px,3.4vw,36px)] leading-[1.15] font-extrabold tracking-[-0.025em]">
          {lapsedOn
            ? c.checkout.lapsedBanner
            : fieldName
              ? c.checkout.unlock(fieldName)
              : c.checkout.unlockGeneric}
        </h1>
        <p className="text-ink-2 text-[16px] leading-[25px]">
          {lapsedOn ? c.checkout.lapsedBody(day(lapsedOn)) : c.checkout.unlockBody}
        </p>
      </header>

      {/* Money already sent, said before anything else on the page: a
          student who paid by transfer and came back to check must not be
          talked into paying again. */}
      {pending ? (
        <section className="border-pending/30 bg-pending-soft rounded-card flex flex-col gap-2 border p-5">
          <Banner tone="pending" icon="clock">
            {c.checkout.submittedBanner}
          </Banner>
          <p className="text-body">{c.checkout.submittedBody(pending.txRef, freeLeft)}</p>
          {/* Named twice on purpose: once in the sentence, once as the
              thing to keep. */}
          <p className="text-caption text-ink-2">{c.checkout.keepReference}</p>
        </section>
      ) : null}

      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="sr-only">{c.checkout.title}</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
          {byLength(plans).map((offer) => (
            <PlanCard
              key={offer.code}
              plan={offer}
              chosen={offer.code === planCode}
              onChoose={() => setPlanCode(offer.code)}
            />
          ))}
        </div>
        {/* Said once, because it is the same for every plan: they differ in
            length, never in what they unlock. */}
        <div className="text-ink-2 flex flex-col gap-1.5 text-[14px]">
          <span className="text-ink font-semibold">{c.checkout.includedTitle}</span>
          {c.checkout.included.map((line) => (
            <span key={line} className="inline-flex items-center gap-1.5">
              <span className="text-correct">
                <Icon name="check" size={16} strokeWidth={2.5} />
              </span>
              {line}
            </span>
          ))}
        </div>
      </fieldset>

      {/*
        Stacked, not side by side as the handoff draws it. Checkout keeps the
        640px reading measure (it is read as sentences, and layout-measure
        holds it there), and two columns at that width wrapped every method's
        description to three lines and the pay button to two.
      */}
      <section className="border-border bg-surface rounded-card flex flex-col gap-6 border p-6">
        <fieldset className="flex flex-col gap-3 border-0 p-0">
          <legend className="font-display mb-1 text-[18px] font-bold">{c.checkout.payWith}</legend>
          {METHODS.map(([value, label, how]) => (
            <label
              key={value}
              data-method={value}
              className={[
                'rounded-option flex min-h-[56px] cursor-pointer items-center gap-3 border-[1.5px] p-3.5',
                method === value
                  ? 'border-link bg-brand-soft'
                  : 'border-border bg-surface hover:border-border-strong',
              ].join(' ')}
            >
              <input
                type="radio"
                name="method"
                className="sr-only"
                value={value}
                checked={method === value}
                onChange={() => {
                  setFieldError(null);
                  setMethodError(null);
                  setMethod(value);
                }}
              />
              <span className="bg-surface-2 inline-flex size-10 shrink-0 items-center justify-center rounded-[10px]">
                <Icon name={METHOD_ICON[value]} size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-ink text-[15px] font-semibold">{label}</span>
                {/* What it will do, before it is chosen. "Approve it on your
                    phone" and "a person verifies it" are very different
                    waits, and the time to find out is now. */}
                <span className="text-ink-2 text-[13px]">{how}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="bg-bg rounded-option flex flex-col gap-4 p-5">
          <h2 className="font-display text-[18px] font-bold">{c.checkout.summary}</h2>
          {plan ? (
            <div className="flex items-baseline justify-between gap-3 text-[15px] font-medium">
              <span>{c.checkout.summaryPlan(plan.months, fieldName)}</span>
              <span className="num">{price}</span>
            </div>
          ) : null}
          <p className="text-ink-3 text-[14px]">{c.checkout.countedFromToday}</p>
          <div className="border-border flex items-baseline justify-between gap-3 border-t pt-4">
            <span className="text-[15px] font-semibold">{c.checkout.total}</span>
            <span className="font-display num text-[28px] font-extrabold">{price}</span>
          </div>

          {/* What the chosen method needs, and nothing the others need. */}
          {direct ? (
            <Input
              label={c.checkout.mobileLabel}
              hint={verifiedPhone ? c.checkout.mobileOnFile : c.checkout.mobileHint}
              error={fieldError ?? undefined}
              inputMode="tel"
              autoComplete="tel"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                setVerifiedPhone(false);
              }}
            />
          ) : null}

          {method === 'bank' ? (
            <>
              <p className="text-body">{c.checkout.transferTo(price)}</p>
              {BANK_ACCOUNT ? (
                <span className="bg-surface border-border rounded-control flex flex-col gap-0.5 border p-3">
                  <span className="text-caption text-ink-2 uppercase">
                    {c.checkout.accountLabel}
                  </span>
                  <span className="text-body num font-semibold">{BANK_ACCOUNT}</span>
                </span>
              ) : (
                // Said, rather than an empty box: a transfer to an account
                // nobody published cannot be matched to anybody.
                <p className="text-pending text-body">{c.checkout.accountNotPublished}</p>
              )}
              <Input
                label={c.checkout.txRefLabel}
                hint={c.checkout.txRefHint}
                error={fieldError ?? undefined}
                value={txRef}
                onChange={(e) => setTxRef(e.target.value)}
              />
            </>
          ) : null}

          {/* The amount and the method, in the button's own words. */}
          <button
            type="button"
            className="bg-brand hover:bg-brand-hover text-on-brand rounded-control disabled:bg-surface-2 disabled:text-ink-2 min-h-[52px] px-5 text-[16px] font-semibold disabled:cursor-not-allowed"
            onClick={() => void pay(method)}
            // A transfer to an account nobody published cannot be matched to
            // anybody, so the claim cannot be sent until there is one.
            disabled={
              busy || !plan || (method === 'bank' && (txRef.trim() === '' || BANK_ACCOUNT === ''))
            }
          >
            {busy
              ? c.checkout.sending
              : method === 'bank'
                ? c.checkout.submitForVerification
                : c.checkout.payAmountWith(price, methodName)}
          </button>
          {method === 'bank' && txRef.trim() === '' && BANK_ACCOUNT !== '' ? (
            <p className="text-ink-3 text-[13px]">{c.checkout.txRefNeeded}</p>
          ) : null}
          {methodError ? (
            <p role="alert" className="bg-pending-soft text-ink rounded-option p-3 text-[14px]">
              {methodError}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** A back chevron and a title. The chevron is the whole way out of a method. */
function Heading({ children, onBack }: { children: string; onBack: () => void }) {
  const c = copy();
  return (
    <div className="flex items-center gap-1">
      {/* 44px of target: it was a 28px arrow, on the screen somebody uses
          while a payment is pending and they want to change their mind. */}
      <button
        type="button"
        onClick={onBack}
        aria-label={c.common.back}
        className="text-ink-2 hover:text-ink rounded-control -ml-3 inline-flex size-11 items-center justify-center"
      >
        <Icon name="chevronLeft" size={20} />
      </button>
      <h1 className="font-display text-[24px] font-extrabold">{children}</h1>
    </div>
  );
}

/** What is being bought, restated on every screen that asks for money. */
function OrderLine({ plan }: { plan: PlanOffer }) {
  const c = copy();
  return (
    <span className="flex items-center justify-between gap-3">
      <span className="text-ink-2 text-[15px]">{c.paywall.months(plan.months)}</span>
      <span className="font-display num text-[24px] font-extrabold">
        {c.paywall.price(plan.priceEtb)}
      </span>
    </span>
  );
}

function PlanCard({
  plan,
  chosen,
  onChoose,
}: {
  plan: PlanOffer;
  chosen: boolean;
  onChoose: () => void;
}) {
  const c = copy();
  return (
    /*
     * A real radio under a pressable card, like the programme chooser: one tab
     * stop for the group, arrow keys between plans, and "radio, 2 of 2".
     */
    <label
      data-plan={plan.code}
      data-selected={chosen}
      className={[
        'rounded-card flex cursor-pointer flex-col gap-3 border-[1.5px] p-5 transition-[background-color,border-color]',
        chosen
          ? 'border-link bg-brand-soft'
          : 'border-border bg-surface hover:border-border-strong',
      ].join(' ')}
    >
      <input
        type="radio"
        name="plan"
        className="sr-only"
        value={plan.code}
        checked={chosen}
        onChange={onChoose}
      />
      <span className="flex flex-wrap items-center gap-2.5">
        {/* The radio drawn, so the choice reads as a choice before the fill
            does: a ring, filled when chosen. */}
        <span
          aria-hidden="true"
          className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
            chosen ? 'border-link' : 'border-border-input'
          }`}
        >
          <span className={`size-2.5 rounded-full ${chosen ? 'bg-link' : 'bg-transparent'}`} />
        </span>
        <span className="font-display text-[18px] font-bold">{c.paywall.months(plan.months)}</span>
        {plan.bestValue ? (
          <span className="bg-brand text-on-brand ml-auto rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap">
            {c.paywall.bestValue}
          </span>
        ) : null}
      </span>
      <span className="font-display num text-[40px] leading-10 font-extrabold">
        {c.paywall.price(plan.priceEtb)}
      </span>
      <span className="text-ink-2 num text-[14px]">{c.paywall.perMonth(plan.perMonthEtb)}</span>
    </label>
  );
}

/** A state banner: soft fill, icon, and the word. Never colour on its own. */
function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'correct' | 'pending' | 'wrong';
  icon: IconName;
  children: string;
}) {
  const CLASS = {
    correct: 'bg-correct-soft text-correct',
    pending: 'bg-pending-soft text-pending',
    wrong: 'bg-wrong-soft text-wrong',
  } as const;
  return (
    <span
      data-banner={tone}
      className={`${CLASS[tone]} rounded-control text-label inline-flex items-center gap-2 p-3`}
    >
      <Icon name={icon} size={18} strokeWidth={2.5} />
      {children}
    </span>
  );
}

/** Shortest plan first. See the note where it is used. */
function byLength(plans: readonly PlanOffer[]): PlanOffer[] {
  return [...plans].sort((a, b) => a.months - b.months);
}

/** m:ss for the elapsed counter. */
function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
