import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { safeDeviceLabel } from '../auth/device-label';

/**
 * One thing that happened, whoever it happened to.
 *
 * A single shape for six different tables, because the question a provider
 * asks — *"what has been going on"* — does not come sorted by table. Six
 * separate endpoints would make the caller merge and re-sort them, and a
 * caller merging six paginated lists by hand is a caller that eventually shows
 * an incomplete picture and does not know it.
 */
export interface ActivityEvent {
  id: string;
  /** What kind of thing this is. The filter, and the icon on the screen. */
  kind: 'staff' | 'signin' | 'signout' | 'payment' | 'practice' | 'exam';
  at: string;
  /**
   * Who did it, as a display name.
   *
   * **Never a legal name and never an IP.** `Session` says so in the schema and
   * the rule holds here for the same reason: this screen is read by somebody
   * other than the person it is about.
   */
  who: string;
  whoId: string;
  /** Whether the actor was staff at the time this was read. */
  staff: boolean;
  /** The one-line summary. Written server-side so the record reads the same everywhere. */
  what: string;
  /** The thing acted on, where there is one — a reference, a stable id, a topic. */
  reference: string | null;
}

export interface ActivityPage {
  events: ActivityEvent[];
  /** Pass back as `before` to get the next page. Null when the feed is exhausted. */
  nextCursor: string | null;
  /** What was counted, so the screen can say where the numbers came from. */
  totals: { staff: number; signins: number; payments: number; attempts: number; sittings: number };
}

export const ACTIVITY_KINDS = [
  'staff',
  'signin',
  'signout',
  'payment',
  'practice',
  'exam',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * Everything that has happened, in one feed (T-227).
 *
 * **Six queries and a merge, not one clever union.** Postgres can union these
 * with enough casting, and the result would be one query nobody can read and
 * nothing can test in pieces. Six typed reads, each capped, merged in memory and
 * cut to the page size is slower on paper and correct in a way somebody can
 * check — and the cap is what stops "everything" meaning "load the attempts
 * table into a Node process".
 *
 * The window is **cursor-based on time**, not offset-based. An offset page two
 * of a feed that is still being written skips whatever arrived in between, which
 * on an audit surface is the one bug that matters.
 */

/**
 * What to call an actor with no user behind it.
 *
 * Two very different things end up here and the old code showed both raw.
 *
 * A **named script** — `dev-publish-script`, `unknown-reviewer`, `reviewer-2` —
 * is worth printing: it says who did it as precisely as the record knows, and
 * inventing a person for it would be worse.
 *
 * A **bare database key** is not. Audit rows outlive the accounts that wrote
 * them, deliberately — deleting a staff member must not erase what they did —
 * so an id whose user is gone is a normal, permanent state rather than a
 * corruption. QA found two of them on the feed reading
 * "cmt1pedei0000qaxcxfqee26z · Staff · Published a question", which tells a
 * provider nothing and puts an internal identifier on a shared surface next to
 * real display names.
 *
 * The test is shape, not a lookup: our own actor strings are hyphenated words,
 * and cuids are a long unbroken run of lowercase alphanumerics. Anything that
 * looks like a key is described; anything readable is shown.
 */
function unresolvedActor(actorId: string): string {
  const looksLikeAKey = /^[a-z0-9]{20,}$/.test(actorId);
  return looksLikeAKey ? 'An account that no longer exists' : actorId;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /** How many rows each source may contribute to one page before merging. */
  private static readonly PER_SOURCE = 120;

  async feed(options: {
    kinds?: readonly ActivityKind[] | undefined;
    before?: string | undefined;
    // `| undefined` spelled out because `exactOptionalPropertyTypes` is on:
    // "may be absent" and "may be undefined" are different types, and a caller
    // forwarding a parsed query parameter has the second one.
    limit?: number | undefined;
  }): Promise<ActivityPage> {
    const limit = Math.min(Math.max(options.limit ?? 60, 1), 200);
    const wanted = new Set<ActivityKind>(options.kinds?.length ? options.kinds : ACTIVITY_KINDS);
    const before = options.before ? new Date(options.before) : null;
    const cap = ActivityService.PER_SOURCE;
    const olderThan = before ? { lt: before } : undefined;

    const [audits, sessions, payments, attempts, sittings] = await Promise.all([
      wanted.has('staff')
        ? this.prisma.auditLog.findMany({
            where: olderThan ? { createdAt: olderThan } : {},
            orderBy: { createdAt: 'desc' },
            take: cap,
          })
        : [],
      wanted.has('signin') || wanted.has('signout')
        ? this.prisma.session.findMany({
            where: olderThan ? { createdAt: olderThan } : {},
            orderBy: { createdAt: 'desc' },
            take: cap,
            select: {
              id: true,
              userId: true,
              deviceLabel: true,
              createdAt: true,
              revokedAt: true,
              revokedReason: true,
            },
          })
        : [],
      wanted.has('payment')
        ? this.prisma.payment.findMany({
            where: olderThan ? { createdAt: olderThan } : {},
            orderBy: { createdAt: 'desc' },
            take: cap,
            select: {
              id: true,
              userId: true,
              method: true,
              status: true,
              amountEtb: true,
              txRef: true,
              createdAt: true,
            },
          })
        : [],
      wanted.has('practice')
        ? this.prisma.attempt.findMany({
            where: olderThan ? { createdAt: olderThan } : {},
            orderBy: { createdAt: 'desc' },
            take: cap,
            select: {
              id: true,
              userId: true,
              isCorrect: true,
              createdAt: true,
              topic: { select: { name: true } },
            },
          })
        : [],
      wanted.has('exam')
        ? this.prisma.sitting.findMany({
            where: olderThan ? { startedAt: olderThan } : {},
            orderBy: { startedAt: 'desc' },
            take: cap,
            select: {
              id: true,
              userId: true,
              startedAt: true,
              closedAt: true,
              closeReason: true,
            },
          })
        : [],
    ]);

    const events: ActivityEvent[] = [];

    for (const row of audits) {
      events.push({
        id: `audit:${row.id}`,
        kind: 'staff',
        at: row.createdAt.toISOString(),
        who: row.actorId,
        whoId: row.actorId,
        staff: true,
        what: staffSentence(row.action, row.entity),
        reference: row.reference ?? row.detail ?? null,
      });
    }

    for (const row of sessions) {
      if (wanted.has('signin')) {
        events.push({
          id: `signin:${row.id}`,
          kind: 'signin',
          at: row.createdAt.toISOString(),
          who: row.userId,
          whoId: row.userId,
          staff: false,
          what: 'Signed in',
          // The device label — "Chrome on Android". Passed through
          // `safeDeviceLabel` again on the way out, even though it is now
          // constrained on the way in: rows written before that existed are
          // still in the table, and this is the surface that would show them.
          reference: safeDeviceLabel(row.deviceLabel),
        });
      }
      if (wanted.has('signout') && row.revokedAt) {
        events.push({
          id: `signout:${row.id}`,
          kind: 'signout',
          at: row.revokedAt.toISOString(),
          who: row.userId,
          whoId: row.userId,
          staff: false,
          what: 'Signed out',
          reference: row.revokedReason,
        });
      }
    }

    for (const row of payments) {
      events.push({
        id: `payment:${row.id}`,
        kind: 'payment',
        at: row.createdAt.toISOString(),
        who: row.userId,
        whoId: row.userId,
        staff: false,
        what: `Started a payment of Br ${row.amountEtb} by ${row.method.toLowerCase()}`,
        reference: row.txRef,
      });
    }

    for (const row of attempts) {
      events.push({
        id: `attempt:${row.id}`,
        kind: 'practice',
        at: row.createdAt.toISOString(),
        who: row.userId,
        whoId: row.userId,
        staff: false,
        // Right or wrong, not a score. A feed that says "got it wrong" about a
        // named student, read by somebody who is not that student, is the thing
        // PRODUCT.md's never-shame rule is protecting against — so it says what
        // happened without a verdict attached to the person.
        what: row.isCorrect ? 'Answered a question correctly' : 'Answered a question',
        reference: row.topic.name,
      });
    }

    for (const row of sittings) {
      events.push({
        id: `sitting:${row.id}`,
        kind: 'exam',
        at: row.startedAt.toISOString(),
        who: row.userId,
        whoId: row.userId,
        staff: false,
        what: row.closedAt ? 'Sat a mock exam' : 'Started a mock exam',
        reference: row.closeReason,
      });
    }

    events.sort((a, b) => b.at.localeCompare(a.at));
    const page = events.slice(0, limit);

    // Names resolved once, after the cut. Resolving before it would fetch a
    // hundred and twenty users to show sixty.
    const ids = [...new Set(page.map((e) => e.whoId))];
    const [users, staff] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, displayName: true },
      }),
      this.prisma.staffMember.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, role: true },
      }),
    ]);
    const names = new Map(users.map((u) => [u.id, u.displayName]));
    const staffIds = new Set(staff.map((s) => s.userId));

    for (const event of page) {
      event.who = names.get(event.whoId) ?? unresolvedActor(event.whoId);
      event.staff = event.staff || staffIds.has(event.whoId);
    }

    return {
      events: page,
      // Only when the page was full. A short page means every source is
      // exhausted, and a cursor there would loop forever on an empty result.
      nextCursor: page.length === limit ? (page[page.length - 1]?.at ?? null) : null,
      totals: {
        staff: audits.length,
        signins: sessions.length,
        payments: payments.length,
        attempts: attempts.length,
        sittings: sittings.length,
      },
    };
  }
}

/**
 * The audit action, as a sentence.
 *
 * Written here rather than stored, so the record can be re-worded without
 * rewriting history — and read from the enum, so a new action that nobody adds
 * a sentence for falls back to something legible rather than to `undefined`.
 */
export function staffSentence(action: string, entity: string): string {
  const SENTENCES: Record<string, string> = {
    PUBLISHED: 'Published a question',
    BOUNCED: 'Sent a question back to review',
    RETIRED: 'Withdrew a question',
    WEIGHTS_DERIVED: 'Recomputed topic weights from the bank',
    WEIGHT_OVERRIDDEN: 'Overrode a topic weight',
    WEIGHT_OVERRIDE_CLEARED: 'Cleared a topic weight override',
    EXAM_BUILT: 'Built a mock paper',
    DEVICES_RESET: "Reset a student's devices",
    ACCOUNT_DEACTIVATED: 'Closed an account',
    ACCOUNT_REACTIVATED: 'Reopened an account',
    PAYMENT_CONFIRMED: 'Approved a payment',
    PAYMENT_REJECTED: 'Rejected a payment',
  };
  return SENTENCES[action] ?? `${action.toLowerCase().replace(/_/g, ' ')} (${entity})`;
}
