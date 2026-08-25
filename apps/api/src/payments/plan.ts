/**
 * What a plan grants and when it runs out (T-140a, T-141a), with no database.
 *
 * **Duration from activation, not from the exam date.** An earlier draft expired
 * everything at the national exam plus a grace week, which meant somebody buying
 * two weeks before it paid the same as somebody buying in September — and the
 * grace week existed only to make that less obviously unfair. Duration is what a
 * person can be told at the point of sale and check afterwards.
 */

/** Whole months, so the arithmetic below is the only place a month is defined. */
export interface PlanShape {
  code: string;
  months: number;
  priceEtb: number;
}

/**
 * When access bought at `activatedAt` runs out.
 *
 * **The month-end rule, which is the whole reason this is a function.** Adding
 * six months to 31 August lands on 31 February, which does not exist. JavaScript
 * silently rolls that to 2 or 3 March depending on the year — so a naive
 * `setMonth` hands out two or three free days, inconsistently, and only to
 * people who happen to buy on the 29th, 30th or 31st.
 *
 * The rule here is **clamp to the last day of the target month**: 31 August plus
 * six months is 28 February, or 29 in a leap year. That is the reading a person
 * would give it, it never grants more than was sold, and it is the same
 * convention every subscription business uses.
 *
 * Built in UTC throughout. The instant matters, not a wall clock — a student who
 * buys at 23:00 in Addis and a server in another zone must agree about when the
 * six months are up.
 */
export function expiresAtFrom(activatedAt: Date, months: number): Date {
  const year = activatedAt.getUTCFullYear();
  const month = activatedAt.getUTCMonth();
  const day = activatedAt.getUTCDate();

  const targetMonth = month + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalisedMonth = ((targetMonth % 12) + 12) % 12;

  // Day 0 of the following month is the last day of this one.
  const lastDayOfTarget = new Date(Date.UTC(targetYear, normalisedMonth + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      targetYear,
      normalisedMonth,
      Math.min(day, lastDayOfTarget),
      activatedAt.getUTCHours(),
      activatedAt.getUTCMinutes(),
      activatedAt.getUTCSeconds(),
      activatedAt.getUTCMilliseconds(),
    ),
  );
}

/** Whether access bought at this instant is still live. */
export function isLive(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt !== null && expiresAt.getTime() > now.getTime();
}

/**
 * The per-month figure the picker shows (T-141a).
 *
 * Rounded to whole birr because that is the unit prices are quoted in, and
 * shown so the twelve-month plan's value is legible without arithmetic: Br 83 a
 * month against Br 67 a month is a comparison somebody can make in a second, and
 * "500" against "800" is not.
 *
 * **Derived, never stored.** A second number that has to be kept in step with a
 * price is a second number that will disagree with it.
 */
export function perMonthEtb(plan: PlanShape): number {
  if (plan.months <= 0) return plan.priceEtb;
  return Math.round(plan.priceEtb / plan.months);
}

export interface PlanOffer extends PlanShape {
  perMonthEtb: number;
  /** How much cheaper per month than the most expensive plan on offer, 0–100. */
  savingPct: number;
  /** True for the plan that costs least per month. At most one. */
  bestValue: boolean;
}

/**
 * The plans as the picker shows them.
 *
 * The saving is computed against the **dearest** plan per month rather than
 * against a made-up "usual price", because that is a comparison the student can
 * check from the two numbers in front of them. A discount measured against a
 * price nobody ever charged is the oldest trick in retail and this product does
 * not do it.
 */
/**
 * The plans a student on this track may buy (T-268).
 *
 * **Grade 12 and below get one annual price and no choice to make.** The
 * exit-exam ladder — six months or twelve, with the per-month saving spelled
 * out — is a decision for somebody choosing how long to study before an exam
 * they are sitting themselves. A school subscription is usually bought by a
 * parent, once, for a child, and offering them a duration trade-off asks a
 * question they have no basis to answer.
 *
 * The test is `maxGrade`, which is exactly the school/exit-exam line already:
 * a school track declares the year it ends in, and an exit exam draws on no
 * school year at all. Same field `bandFor` reads, so the two cannot disagree
 * about which kind of student this is.
 *
 * Falls back to the exit-exam plans when the track is unknown — a student with
 * no programme chosen is not yet a school student, and showing them nothing
 * would be a checkout page with no way to pay.
 */
export function plansForTrack<T extends { code: string }>(
  plans: readonly T[],
  maxGrade: number | null,
): readonly T[] {
  const school = maxGrade !== null;
  const wanted = plans.filter((plan) =>
    school ? plan.code === 'SCHOOL_YEAR' : plan.code !== 'SCHOOL_YEAR',
  );
  /*
   * Never an empty list.
   *
   * If the school plan is withdrawn — `isActive: false` — a Grade 6 student
   * would otherwise reach a checkout with nothing on it and no way to tell
   * whether that was a bug. Better they see the ordinary plans than a dead end.
   */
  return wanted.length > 0 ? wanted : plans;
}

export function offersFrom(plans: readonly PlanShape[]): PlanOffer[] {
  if (plans.length === 0) return [];

  const withRate = plans.map((plan) => ({ ...plan, perMonthEtb: perMonthEtb(plan) }));
  const dearest = Math.max(...withRate.map((p) => p.perMonthEtb));
  const cheapest = Math.min(...withRate.map((p) => p.perMonthEtb));

  return (
    withRate
      .map((plan) => ({
        ...plan,
        savingPct: dearest === 0 ? 0 : Math.round(((dearest - plan.perMonthEtb) / dearest) * 100),
        // Only when something is actually cheaper — with one plan, or two priced
        // the same per month, nothing is "best value" and saying so would be a
        // claim about nothing.
        bestValue: plan.perMonthEtb === cheapest && cheapest < dearest,
      }))
      // Cheapest per month first: the picker's job is to make the better deal
      // legible, not to lead with the smaller number.
      .sort((a, b) => a.perMonthEtb - b.perMonthEtb || a.months - b.months)
  );
}

/**
 * When a renewal should start counting from (T-146a).
 *
 * **From the existing expiry, not from today.** A student who renews a week
 * early would otherwise lose that week — and the behaviour it teaches is to wait
 * until access has actually lapsed before paying, which is worse for them and
 * worse for the product. Renewing early should never cost anything.
 *
 * From `now` once access has lapsed: a subscription that ended in March does not
 * silently backdate a renewal bought in June to March, which would sell somebody
 * three months they cannot use.
 */
export function renewalStartsAt(currentExpiry: Date | null, now: Date): Date {
  if (currentExpiry === null) return now;
  return currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
}
