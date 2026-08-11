/**
 * What a community post may be, and who is answering (T-195, T-196, T-197).
 *
 * No database and no clock — the rules that are worth arguing about are here,
 * where they can be argued with.
 *
 * **The stance this file takes: a question bank's comment section is a place
 * students go when they are stuck and frightened, not a forum.** Everything
 * below follows from that. Threads are scoped so a student never wades through
 * another programme's arguments; a reviewer's reply is marked so the correct
 * answer is findable in a thread of guesses; and the limits are set to stop a
 * flood without stopping somebody typing quickly.
 */

/** How long a post may be. */
export const MAX_BODY_CHARS = 2000;
export const MIN_BODY_CHARS = 2;

/**
 * Who wrote a reply, and whether the product vouches for it (T-196).
 *
 * `REVIEWER` and `ADMIN` are the staff roles that review questions, so their
 * word on a question carries the product's weight. A student's does not — not
 * because students are wrong, but because a badge that anybody can earn is a
 * badge that answers nothing.
 */
export type AuthorRole = 'STUDENT' | 'REVIEWER' | 'ADMIN';

export function isVerifiedAuthor(role: AuthorRole): boolean {
  return role === 'REVIEWER' || role === 'ADMIN';
}

// The posting limits live in `common/rate-limit.ts` with every other limit in
// the product, as `communityPost` and `communityPostHourly` — one table of
// numbers is one place to look when somebody asks why they were refused.

export interface PostContent {
  body: string;
}

export type PostRejection =
  | { ok: false; error: 'BODY_REQUIRED'; message: string }
  | { ok: false; error: 'BODY_TOO_LONG'; message: string };

export type PostCheck = { ok: true; body: string } | PostRejection;

/**
 * Whether a post may be written, and what it says if not.
 *
 * Both messages name the fix, per PRODUCT.md's voice rule — an error that says
 * only what is wrong leaves somebody staring at a form they have just lost.
 */
export function checkPost(content: PostContent): PostCheck {
  const body = content.body.trim();

  if (body.length < MIN_BODY_CHARS) {
    return {
      ok: false,
      error: 'BODY_REQUIRED',
      message: 'Write your question or answer before posting.',
    };
  }
  if (body.length > MAX_BODY_CHARS) {
    return {
      ok: false,
      error: 'BODY_TOO_LONG',
      message: `That is longer than ${MAX_BODY_CHARS} characters. Shorten it and post again — nothing you typed is lost.`,
    };
  }
  return { ok: true, body };
}

/** Why somebody flagged a post. Fixed set, because free text is not triage. */
export const REPORT_REASONS = ['WRONG', 'ABUSIVE', 'SPAM', 'OFF_TOPIC'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

/**
 * Whether a post is shown to students.
 *
 * **Reporting hides nothing on its own** (T-197). A single report is one
 * person's opinion, and a product where one tap removes another student's
 * question has handed every argument to whoever reports first. A report queues
 * the post for a person to look at; only that person hides it.
 *
 * The exception is the author, who always sees their own post — somebody whose
 * question vanished without explanation assumes it was censored, and they are
 * halfway right.
 */
export function isVisible(
  post: { hiddenAt: Date | null; authorId: string },
  viewerId: string,
): boolean {
  return post.hiddenAt === null || post.authorId === viewerId;
}
