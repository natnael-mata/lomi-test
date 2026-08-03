/**
 * Does this student have paid access to this field?
 *
 * A **seam**, not an implementation. `Subscription` and `Plan` are Phase 8 models
 * and a second session is building them right now in a parallel worktree —
 * creating them here would collide head-on. So the free-tier gate asks this
 * question through an interface, and Phase 8 supplies the real answer later by
 * providing a different implementation against the same token. Nothing in
 * `practice/` changes when it does.
 */
export interface SubscriptionAccess {
  hasActiveSubscription(userId: string, fieldId: string): Promise<boolean>;
}

/** Nest injection token — an interface has no runtime identity to inject by. */
export const SUBSCRIPTION_ACCESS = 'SUBSCRIPTION_ACCESS';

/**
 * The truthful answer until Phase 8 lands: **nobody has a subscription**, because
 * there is nothing to buy and no table to record a purchase in.
 *
 * Deliberately not a stub that returns `true` "so the tests pass". A permissive
 * default would mean the free limit is never enforced, and the day Phase 8 ships
 * is the day everyone's access silently changes. Returning `false` makes the
 * limit real now and makes the Phase 8 swap a widening of access, which is the
 * safe direction to be wrong in.
 */
export class NoSubscriptionsYet implements SubscriptionAccess {
  hasActiveSubscription(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
