/**
 * The community rules (T-195, T-196, T-197).
 *
 * The scoping and the badge are proved end to end in `community.e2e.test.ts`.
 * What is checked here is the part with judgement in it: who the product
 * vouches for, what a post may be, and what a report does — which is less than
 * people expect, on purpose.
 */
import { describe, expect, it } from 'vitest';

import {
  MAX_BODY_CHARS,
  REPORT_REASONS,
  checkPost,
  isReportReason,
  isVerifiedAuthor,
  isVisible,
  type AuthorRole,
} from './community';
import { RATE_LIMITS } from '../common/rate-limit';

describe('who the product vouches for (T-196)', () => {
  /** T-196's stated test. */
  it('marks a reviewer’s reply and not a student’s', () => {
    expect(isVerifiedAuthor('REVIEWER')).toBe(true);
    expect(isVerifiedAuthor('ADMIN')).toBe(true);
    expect(isVerifiedAuthor('STUDENT')).toBe(false);
  });

  /**
   * The badge is worth something only because it cannot be earned by
   * participating. A student who posts a hundred good answers is still a
   * student — the badge says "the people who review the questions said this",
   * not "this person is helpful".
   */
  it('cannot be reached by any role a student can hold', () => {
    const studentReachable: AuthorRole[] = ['STUDENT'];
    for (const role of studentReachable) {
      expect(isVerifiedAuthor(role), role).toBe(false);
    }
  });
});

describe('what a post may be', () => {
  it('accepts an ordinary question', () => {
    const result = checkPost({ body: '  Why is B correct here?  ' });
    expect(result).toEqual({ ok: true, body: 'Why is B correct here?' });
  });

  it('refuses an empty post', () => {
    for (const body of ['', ' ', '\n\t ', 'a']) {
      const result = checkPost({ body });
      expect(result.ok, JSON.stringify(body)).toBe(false);
    }
  });

  it('refuses one longer than the limit', () => {
    expect(checkPost({ body: 'x'.repeat(MAX_BODY_CHARS + 1) }).ok).toBe(false);
    expect(checkPost({ body: 'x'.repeat(MAX_BODY_CHARS) }).ok).toBe(true);
  });

  /**
   * PRODUCT.md's voice rule: errors state cause **and** fix. Somebody who has
   * just written two thousand words needs to be told their text is safe, not
   * that they were wrong.
   */
  it('tells somebody what to do, and that their words are safe', () => {
    const result = checkPost({ body: 'x'.repeat(MAX_BODY_CHARS + 1) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('Shorten it');
    expect(result.message).toContain('nothing you typed is lost');
    expect(result.message.split(/\s+/).length).toBeGreaterThan(6);
  });

  it('never shames somebody for an empty box', () => {
    const result = checkPost({ body: '' });
    if (result.ok) throw new Error('expected a refusal');
    for (const word of ['invalid', 'error', 'failed', 'must not']) {
      expect(result.message.toLowerCase(), result.message).not.toContain(word);
    }
  });
});

describe('reporting (T-197)', () => {
  it('takes a reason from a fixed set', () => {
    for (const reason of REPORT_REASONS) expect(isReportReason(reason)).toBe(true);
    for (const junk of ['', 'BECAUSE', 'wrong', 'other']) {
      expect(isReportReason(junk), junk).toBe(false);
    }
  });

  /**
   * **A report hides nothing.** One report is one person's opinion, and a
   * product where a single tap removes another student's question has handed
   * every argument to whoever reports first. Reporting queues the post for a
   * person; only that person hides it.
   */
  it('leaves a reported post visible until somebody acts', () => {
    const post = { hiddenAt: null, authorId: 'author' };
    expect(isVisible(post, 'anybody')).toBe(true);
  });

  it('hides it once somebody has', () => {
    const post = { hiddenAt: new Date('2026-08-10T00:00:00.000Z'), authorId: 'author' };
    expect(isVisible(post, 'somebody-else')).toBe(false);
  });

  /**
   * The author still sees it. Somebody whose question vanished without
   * explanation assumes it was censored, and they are halfway right.
   */
  it('still shows the author their own hidden post', () => {
    const post = { hiddenAt: new Date('2026-08-10T00:00:00.000Z'), authorId: 'author' };
    expect(isVisible(post, 'author')).toBe(true);
  });
});

describe('the posting limit (T-197)', () => {
  /** The number the task's test fixes: the sixth post in a minute is refused. */
  it('allows five a minute', () => {
    expect(RATE_LIMITS.communityPost.limit).toBe(5);
    expect(RATE_LIMITS.communityPost.windowSec).toBe(60);
  });

  /** And a slower flood is still a flood. */
  it('also bounds the hour', () => {
    expect(RATE_LIMITS.communityPostHourly.windowSec).toBe(3600);
    expect(RATE_LIMITS.communityPostHourly.limit).toBeGreaterThan(RATE_LIMITS.communityPost.limit);
  });
});
