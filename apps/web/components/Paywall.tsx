'use client';

/**
 * The tenth free question (design handoff 1e, T-141).
 *
 * *"A different screen with a different action — not an error."* That sentence
 * is the whole component. A 402 from the API is the free tier ending exactly as
 * designed, and rendering it as a red box with "something went wrong" would
 * tell a student the product broke at the moment it started asking for money.
 *
 * Three things it must do, in the order a student reads them:
 *
 * 1. **Say what just happened**, with the number — the tenth, not "your free
 *    questions". A count they can check against their own memory.
 * 2. **Show both plans with the per-month figure worked out.** DESIGN.md's rule
 *    is that every number on screen is reconstructable; `Br 800` and
 *    `Br 67 / month` sit together so the division is on the page rather than in
 *    the student's head.
 * 3. **One action.** Not "maybe later" and not a dismissal — the screen has a
 *    bottom bar, and leaving is a tap away without a button that argues.
 *
 * No countdown, no "offer ends", no strike-through price. The saving is stated
 * as arithmetic because it is arithmetic.
 */
import { Chip } from './Chip';
import { Icon } from './icons';
import type { PlanOffer } from '../lib/api';
import { copy } from '../lib/i18n';

export interface PaywallProps {
  plans: readonly PlanOffer[];
  /** Where the action goes. The checkout, unless this *is* the checkout. */
  href?: string | undefined;
}

export function Paywall({ plans, href = '/checkout' }: PaywallProps) {
  const c = copy();

  return (
    <div className="flex flex-1 flex-col gap-4" data-state="paywalled">
      <div className="flex justify-end">
        {/* Pending, not wrong. Running out of free questions is a state the
            product planned for; the amber says "waiting on you", which is
            true, and the icon and words say it without the colour. */}
        <Chip tone="pending" className="uppercase">
          <Icon name="clock" size={14} />
          {c.practice.freeLeft(0)}
        </Chip>
      </div>

      <section className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(24px,3vw,30px)] leading-[1.15] font-extrabold tracking-[-0.025em]">
          {c.paywall.title}
        </h1>
        <p className="text-body text-ink-2">{c.paywall.intro}</p>
      </section>

      {/* Shortest commitment first: a student who has just hit a wall reads the
          smaller ask first, and the recommendation is still marked. */}
      {[...plans]
        .sort((a, b) => a.months - b.months)
        .map((plan) => (
          <PlanRow key={plan.code} plan={plan} />
        ))}

      <p className="text-caption text-ink-2 text-center">{c.paywall.footnote}</p>

      {/* Pinned above the tab bar, like "Check answer" on the screen this one
          replaces, rather than `mt-auto`, which only reached the bottom when
          the page was shorter than the screen. */}
      <div className="bg-bg sticky-foot -mx-1 px-1 pt-2 pb-2">
        <a href={href} className="btn-primary">
          {c.paywall.cta}
        </a>
      </div>
    </div>
  );
}

/**
 * One plan.
 *
 * The best-value plan takes a brand border and a reward-yellow marker; the
 * other takes the card shadow and nothing else. Yellow is a **fill with ink on
 * top** — never text, never white on top — which is the one rule the reward
 * colour has.
 */
function PlanRow({ plan }: { plan: PlanOffer }) {
  const c = copy();
  const best = plan.bestValue;

  return (
    <div
      data-plan={plan.code}
      data-best={best ? 'yes' : 'no'}
      // The checkout's plan card, read only: the same lemon wash and amber
      // edge mark the recommendation here as there, so the two screens name
      // one plan the same way.
      className={[
        'rounded-card flex items-center justify-between gap-3 border-[1.5px] p-5',
        best ? 'border-link bg-brand-soft' : 'border-border bg-surface',
      ].join(' ')}
    >
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-[17px] font-bold">
            {c.paywall.months(plan.months)}
          </span>
          {best ? (
            <span className="bg-brand text-on-brand rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap">
              {c.paywall.bestValue}
            </span>
          ) : null}
        </span>
        <span className="text-caption text-ink-2 num">{c.paywall.perMonth(plan.perMonthEtb)}</span>
      </span>
      <span className="font-display num text-[28px] font-extrabold">
        {c.paywall.price(plan.priceEtb)}
      </span>
    </div>
  );
}
