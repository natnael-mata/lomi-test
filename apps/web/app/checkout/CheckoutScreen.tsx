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
import { Card } from '../../components/Card';
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
  | { kind: 'choosing' }
  /** A method has been picked and is collecting whatever it needs. */
  | { kind: 'method'; method: Method }
  | { kind: 'redirecting' }
  /** A push is on its way to a handset, or the student has come back from Chapa. */
  | { kind: 'waiting'; txRef: string; mobile: string | null; slow: boolean; method: Method }
  | { kind: 'confirmed'; expiresAt: string | null }
  | { kind: 'submitted'; txRef: string }
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
  const [mobile, setMobile] = useState('');
  /** Set when the number came from Telegram rather than from the keyboard. */
  const [verifiedPhone, setVerifiedPhone] = useState(false);
  const [txRef, setTxRef] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
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

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [offers, subscription, contact, history] = await Promise.all([
          api.plans(),
          api.mySubscription().catch(() => null),
          // Never fatal: a checkout that refuses to open because a convenience
          // lookup failed is a checkout that refuses money.
          api.myContact().catch(() => null),
          api.paymentHistory().catch(() => null),
        ]);
        if (!alive) return;
        setPlans(offers);

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

  const pay = useCallback(
    async (method: Method): Promise<void> => {
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
        setPhase({ kind: 'submitted', txRef: txRef.trim() });
      } catch (error) {
        fail(error);
      } finally {
        setBusy(false);
      }
    },
    [fail, mobile, planCode, txRef],
  );

  const plan = plans.find((p) => p.code === planCode) ?? null;

  if (phase.kind === 'loading') return <p className="text-body text-ink-2">{c.checkout.working}</p>;
  if (phase.kind === 'subscribed') return <Receipt />;

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
      <div className="flex flex-col gap-3" aria-live="polite">
        <Heading onBack={() => setPhase({ kind: 'choosing' })}>{c.checkout[phase.method]}</Heading>

        <Card as="section" className="flex flex-col gap-3 p-5">
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
          {/* Always on screen, not only on the outcome: a student reading a
              reference to support is usually mid-wait. */}
          <p className="text-caption text-ink-2">{c.checkout.yourReference(phase.txRef)}</p>
        </Card>

        {phase.slow ? (
          <Card as="section" className="flex flex-col gap-3 p-5">
            <Banner tone="pending" icon="clock">
              {c.checkout.slowBanner}
            </Banner>
            <p className="text-body">{c.checkout.slowBody}</p>
            {/* Ghost buttons: the brand shadow belongs to one primary action
                per screen, and neither of these is it. */}
            <Button variant="ghost" onClick={() => void pay(phase.method)} disabled={busy}>
              {c.checkout.sendAgain}
            </Button>
            <Button variant="ghost" onClick={() => setPhase({ kind: 'choosing' })}>
              {c.checkout.payDifferently}
            </Button>
          </Card>
        ) : null}
      </div>
    );
  }

  if (phase.kind === 'submitted') {
    return (
      <div className="flex flex-col gap-3">
        <Heading onBack={() => setPhase({ kind: 'choosing' })}>{c.checkout.bank}</Heading>
        <Card as="section" className="flex flex-col gap-3 p-5">
          {/* Pending, not success. A claim grants nothing until a person has
              read the statement, and a green tick here would say otherwise. */}
          <Banner tone="pending" icon="clock">
            {c.checkout.submittedBanner}
          </Banner>
          <p className="text-body">{c.checkout.submittedBody(phase.txRef)}</p>
          <p className="text-caption text-ink-2">{c.checkout.yourReference(phase.txRef)}</p>
        </Card>
      </div>
    );
  }

  if (phase.kind === 'method') {
    const { method } = phase;
    const direct = method === 'telebirr' || method === 'cbebirr';
    return (
      <div className="flex flex-col gap-3">
        <Heading onBack={() => setPhase({ kind: 'choosing' })}>{c.checkout[method]}</Heading>

        <Card as="section" className="flex flex-col gap-3 p-5">
          {plan ? <OrderLine plan={plan} /> : null}
          <span className="bg-border h-px" />

          {direct ? (
            <Input
              label={c.checkout.mobileLabel}
              // Says where the number came from when it was not typed here.
              // A field that fills itself with no explanation reads as the
              // product knowing something it should not.
              hint={verifiedPhone ? c.checkout.mobileFromTelegram : c.checkout.mobileHint}
              error={fieldError ?? undefined}
              inputMode="tel"
              autoComplete="tel"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                // Edited by hand, so it is no longer the number Telegram
                // vouched for and the screen must stop saying it is.
                setVerifiedPhone(false);
              }}
            />
          ) : null}

          {method === 'chapa' ? <p className="text-body">{c.checkout.chapaHow}</p> : null}

          {method === 'bank' ? (
            <>
              <p className="text-body">
                {c.checkout.transferTo(c.paywall.price(plan?.priceEtb ?? 0))}
              </p>
              {BANK_ACCOUNT ? (
                <span className="bg-surface-2 rounded-control flex flex-col gap-0.5 p-3">
                  <span className="text-caption text-ink-2 uppercase">
                    {c.checkout.accountLabel}
                  </span>
                  <span className="text-body num font-semibold">{BANK_ACCOUNT}</span>
                </span>
              ) : (
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

          {/*
            A bank claim needs its reference before it can be sent (T-269).

            This was `disabled={busy}` alone, so "Submit for verification" was
            live with the reference box empty — and the product's convention
            everywhere else is the opposite: a control that cannot work yet is
            disabled and says what is missing ("Choose an answer first", "Add a
            title and a question first"). The reference is the only thing that
            lets an operator find the transfer on a statement, so a claim
            without one is a row nobody can settle and a student waiting on it.
          */}
          <Button
            onClick={() => void pay(method)}
            disabled={busy || (method === 'bank' && txRef.trim() === '')}
            blockingReason={
              method === 'bank' && txRef.trim() === '' ? c.checkout.txRefNeeded : undefined
            }
          >
            {busy
              ? c.checkout.sending
              : method === 'bank'
                ? c.checkout.submitForVerification
                : c.checkout.pay}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-title">{lapsedOn ? c.checkout.lapsedBanner : c.checkout.heading}</h1>

      {/*
        Paid before, and ran out.

        The plans below are the same; the framing is not. A student who bought
        twelve months and lapsed was shown the identical first-time page — "Get
        full access", "Counted from today", no end date, no history — and told
        on `/practice` that they had used up their ten free questions. Both QA
        passes reported it, and both were right: the product had the fact and
        never used it.
      */}
      {lapsedOn ? (
        <Card as="section" data-lapsed="" className="flex flex-col gap-2">
          <Banner tone="pending" icon="clock">
            {c.checkout.lapsedBanner}
          </Banner>
          <p className="text-body">{c.checkout.lapsedBody(day(lapsedOn))}</p>
        </Card>
      ) : null}

      {/*
        The claim already with the team, above the plans.
        Pending rather than success — nothing has been granted — and it names
        the reference, because the reference is the only thing a student has to
        quote if they have to ask about it.
      */}
      {pending ? (
        <Card as="section" className="flex flex-col gap-2">
          <Banner tone="pending" icon="clock">
            {c.checkout.submittedBanner}
          </Banner>
          <p className="text-body">{c.checkout.submittedBody(pending.txRef)}</p>
          {/* The reference is already in the sentence above; this says only the
              part that is not — keep it, it is what support looks up. */}
          <p className="text-caption text-ink-2">{c.checkout.keepReference}</p>
        </Card>
      ) : null}

      {/* Side by side, so the two prices and the two per-month figures can be
          compared without scrolling between them. */}
      {/*
        Shortest commitment first, which is not the order the API returns.
        `GET /payments/plans` sorts cheapest-per-month first — right for
        deciding which plan to *recommend*, wrong for laying two of them out
        side by side, where a student reads left to right and the left-hand card
        should be the smaller ask. The recommendation still shows: it is the
        one carrying the border and the Best value marker.
      */}
      <fieldset className="flex gap-2">
        <legend className="sr-only">{c.checkout.title}</legend>
        {byLength(plans).map((offer) => (
          <PlanCard
            key={offer.code}
            plan={offer}
            chosen={offer.code === planCode}
            onChoose={() => setPlanCode(offer.code)}
          />
        ))}
      </fieldset>

      <p className="text-caption text-ink-2">{c.checkout.countedFromToday}</p>
      <p className="text-caption text-ink-2">{c.checkout.howToPay}</p>

      <div className="flex flex-col gap-2">
        {(
          [
            ['telebirr', c.checkout.telebirr, c.checkout.telebirrHow],
            ['cbebirr', c.checkout.cbebirr, c.checkout.cbebirrHow],
            ['chapa', c.checkout.chapa, c.checkout.chapaHow],
            ['bank', c.checkout.bank, c.checkout.bankHow],
          ] as const
        ).map(([value, label, how]) => (
          <button
            key={value}
            type="button"
            data-method={value}
            className="border-border bg-surface rounded-control flex min-h-[56px] w-full items-center gap-3 border-2 p-3 text-left"
            onClick={() => {
              setFieldError(null);
              setPhase({ kind: 'method', method: value });
            }}
          >
            <span className="bg-surface-2 inline-flex size-10 shrink-0 items-center justify-center rounded-[10px]">
              <Icon name={METHOD_ICON[value]} size={20} />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-label">{label}</span>
              {/* What actually happens next, on the option itself. A student
                  choosing between four wallets should not have to press one to
                  find out whether it opens a page or rings their phone. */}
              <span className="text-caption text-ink-2">{how}</span>
            </span>
            <Icon name="chevronRight" size={18} className="text-ink-2" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** A back chevron and a title. The chevron is the whole way out of a method. */
function Heading({ children, onBack }: { children: string; onBack: () => void }) {
  const c = copy();
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onBack} aria-label={c.common.back} className="p-1">
        <Icon name="chevronLeft" size={20} className="text-ink-2" />
      </button>
      <h1 className="text-title">{children}</h1>
    </div>
  );
}

/** What is being bought, restated on every screen that asks for money. */
function OrderLine({ plan }: { plan: PlanOffer }) {
  const c = copy();
  return (
    <span className="flex items-center justify-between gap-3">
      <span className="text-body text-ink-2">{c.paywall.months(plan.months)}</span>
      <span className="text-title num font-display">{c.paywall.price(plan.priceEtb)}</span>
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
    <label
      data-plan={plan.code}
      data-selected={chosen}
      className={[
        'rounded-card flex flex-1 cursor-pointer flex-col gap-0.5 border-2 p-3',
        chosen ? 'border-ink bg-brand-soft' : 'border-border bg-surface',
      ].join(' ')}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-label">{c.paywall.months(plan.months)}</span>
        {/* The word, not only the fill — this is the one control on the screen
            whose state decides what the next screen charges. */}
        {chosen ? (
          <span className="text-caption text-ink uppercase">{c.checkout.chosen}</span>
        ) : null}
      </span>
      <span className="text-title num font-display">{c.paywall.price(plan.priceEtb)}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-caption text-ink-2 num">{c.paywall.perMonth(plan.perMonthEtb)}</span>
        {plan.bestValue ? (
          <span className="bg-reward-fill text-on-reward text-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5">
            <Icon name="star" size={11} strokeWidth={2.5} />
            {c.paywall.bestValue}
          </span>
        ) : null}
      </span>
      <input
        type="radio"
        name="plan"
        className="sr-only"
        value={plan.code}
        checked={chosen}
        onChange={onChoose}
      />
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
