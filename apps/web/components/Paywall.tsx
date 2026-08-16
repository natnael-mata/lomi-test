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
import { Card } from './Card';
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
    <div className="flex flex-1 flex-col gap-3" data-state="paywalled">
      <div className="flex justify-end">
        {/* Pending, not wrong. Running out of free questions is a state the
            product planned for; the amber says "waiting on you", which is
            true, and the icon and words say it without the colour. */}
        <Chip tone="pending" className="uppercase">
          <Icon name="clock" size={14} />
          {c.practice.freeLeft(0)}
        </Chip>
      </div>

      <Card as="section" className="flex flex-col gap-2 p-5">
        <h1 className="text-title">{c.paywall.title}</h1>
        <p className="text-body text-ink-2">{c.paywall.intro}</p>
      </Card>

      {/* Shortest commitment first: a student who has just hit a wall reads the
          smaller ask first, and the recommendation is still marked. */}
      {[...plans]
        .sort((a, b) => a.months - b.months)
        .map((plan) => (
          <PlanRow key={plan.code} plan={plan} />
        ))}

      <p className="text-caption text-ink-2 text-center">{c.paywall.footnote}</p>

      {/* `mt-auto` so the action sits at the bottom of the viewport on a phone
          rather than halfway up it — the same placement as "Check answer" on
          the screen this one replaces. */}
      <a href={href} className="btn-primary mt-auto">
        {c.paywall.cta}
      </a>
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
      className={[
        'rounded-card bg-surface flex items-center justify-between gap-3 p-4',
        best ? 'border-brand border-2' : 'shadow-card',
      ].join(' ')}
    >
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="text-label">{c.paywall.months(plan.months)}</span>
          {best ? (
            <span className="bg-reward-fill text-on-reward text-caption inline-flex items-center gap-1 rounded-full px-2.5 py-0.5">
              <Icon name="star" size={12} strokeWidth={2.5} />
              {c.paywall.bestValue}
            </span>
          ) : null}
        </span>
        <span className="text-caption text-ink-2 num">{c.paywall.perMonth(plan.perMonthEtb)}</span>
      </span>
      <span className="text-title num font-display">{c.paywall.price(plan.priceEtb)}</span>
    </div>
  );
}
