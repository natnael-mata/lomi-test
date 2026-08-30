/**
 * What the Phase 11 screens may and may not do (T-190…T-197).
 *
 * The behaviour is proved on the API side. What is checked here is what only
 * these screens can get wrong: shaming a missed day, dressing a capped list as
 * a total, or putting a name on a public board that has no business being there.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../lib/strip-comments';
import { en } from '../../lib/i18n/dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const standing = stripComments(readFileSync(resolve(here, 'StandingScreen.tsx'), 'utf8'));
/*
 * The board moved out of the screen and into its own component (T-257).
 *
 * The rules these tests protect — no legal name on a public surface, an
 * opted-out student still told their rank — did not move with it by accident:
 * they are properties of *the board*, wherever the board lives. So the scans
 * read both files, and a rule that gets lost in a future refactor still fails
 * here rather than passing because the code it guarded went somewhere else.
 */
const bandedBoard = stripComments(
  readFileSync(resolve(here, '../../components/BandedBoard.tsx'), 'utf8'),
);
const boardSurfaces = `${standing}\n${bandedBoard}`;
const community = stripComments(
  readFileSync(resolve(here, '../community/[topicId]/CommunityScreen.tsx'), 'utf8'),
);
/*
 * The reason labels moved into a shared helper (T-268).
 *
 * They were written inline in the student's picker and nowhere else, so the
 * moderation queue — ruling on those same reports — rendered the stored enum
 * instead: an operator read `OFF_TOPIC` where the student had clicked "Off
 * topic". One list, asked by both screens, is the fix, and these scans follow
 * it rather than passing because the strings went somewhere else.
 */
const reportReasons = stripComments(
  readFileSync(resolve(here, '../../lib/report-reasons.ts'), 'utf8'),
);
const moderation = stripComments(
  readFileSync(resolve(here, '../admin/community/ModerationScreen.tsx'), 'utf8'),
);

describe('the standing screen (T-190…T-194)', () => {
  it('still has code left after the comments are stripped', () => {
    expect(boardSurfaces).toContain('c.standing.board');
    expect(standing.length).toBeGreaterThan(2000);
    expect(community).toContain('c.community.ask');
    expect(community.length).toBeGreaterThan(2000);
  });

  /**
   * **The commitment the whole phase exists for.** A student revising for a
   * national exam will miss days; a screen that says they lost something is the
   * product telling somebody who already feels behind that they are back to the
   * start.
   */
  it('has no way to say a streak was lost', () => {
    for (const word of ['lost', 'broken', 'reset', 'streakLost', 'brokeStreak']) {
      expect(standing, word).not.toContain(word);
    }
    // And the copy has no such string to render even if the screen wanted one.
    const every = JSON.stringify(en.standing);
    expect(every.toLowerCase()).not.toContain('lost your');
    expect(every.toLowerCase()).not.toContain('broke');
  });

  /**
   * DESIGN.md's Total Rule. The ledger below the figure is capped at the most
   * recent awards, so those rows do **not** add up to the total — a total bar
   * would be a claim a student could check and find false.
   */
  it('states the points figure rather than totalling a capped list', () => {
    expect(standing).toContain('StatedFigure');
    expect(standing).not.toContain('TotalBar');
    // And it says the list is partial, so nobody concludes the total is wrong.
    expect(standing).toContain('c.standing.recentOnly');
  });

  it('shows every award with the sentence that explains it (T-190)', () => {
    // A number with no reason beside it is one a student cannot argue with.
    expect(standing).toContain('row.reason');
  });

  it('reads the tier as a shape as well as a number (T-192)', () => {
    expect(standing).toContain('TierBadge');
  });

  /**
   * T-194: hiding the row never hides the rank. A product that answers "you
   * have opted out" when asked "how am I doing" has punished somebody for a
   * privacy choice.
   */
  it('still shows an opted-out student their own rank', () => {
    expect(boardSurfaces).toContain('c.standing.yourRank');
    expect(boardSurfaces).toContain('c.standing.notListed');
    expect(en.standing.notListed.toLowerCase()).toContain('still');
  });

  it('offers the choice in both directions', () => {
    expect(standing).toContain('c.standing.hideMe');
    expect(standing).toContain('c.standing.showMe');
  });

  it('never renders a legal name on the board (T-193)', () => {
    for (const forbidden of ['verifiedName', 'legalName', 'fullName', 'userId']) {
      expect(boardSurfaces, forbidden).not.toContain(forbidden);
    }
    expect(boardSurfaces).toContain('row.displayName');
  });
});

describe('the community screen (T-195…T-197)', () => {
  /**
   * A tick nobody can interpret is decoration. "Reviewer", plus what that
   * means, is a reason to trust this reply over the three above it.
   */
  it('says what the verified badge means', () => {
    expect(community).toContain('post.verified');
    expect(community).toContain('c.community.verifiedMeans');
    expect(en.community.verifiedMeans.split(/\s+/).length).toBeGreaterThan(4);
  });

  it('tells the author when their own post has been hidden', () => {
    // Somebody whose reply vanished without a word assumes it was censored.
    expect(community).toContain('post.hidden');
    expect(community).toContain('c.community.hidden');
  });

  it('offers a reason for a report rather than a bare button', () => {
    for (const key of ['reportWrong', 'reportAbusive', 'reportSpam', 'reportOffTopic'] as const) {
      expect(reportReasons, key).toContain(`c.community.${key}`);
    }
    // The picker still renders all four, from the shared list.
    expect(community).toContain('REPORT_REASONS.map');
    expect(community).toContain('reasonLabel(');
  });

  /**
   * The operator reads what the student clicked.
   *
   * The queue printed `report.reason` straight out of the database, so a
   * moderator ruling on a report saw `OFF_TOPIC` — screaming snake case,
   * underscore and all — where the student had chosen "Off topic". A stored
   * value on a person's screen is a missing translation, not a label.
   */
  it('names the report reason in words on the moderation queue', () => {
    expect(moderation).toContain('reasonLabel(report.reason');
    expect(moderation).not.toMatch(/\{report\.reason\}/);
  });

  /**
   * Restore has a screen it can actually appear on.
   *
   * Hiding a post settles its report, and the queue is the unreviewed reports —
   * so the row left the screen at the moment the undo became relevant, and the
   * button promising "you can put it back" was reachable from nowhere.
   */
  it('lists what is currently hidden, so hiding can be undone', () => {
    expect(moderation).toContain('api.hiddenPosts');
    expect(moderation).toContain('c.admin.moderation.restore');
    expect(en.admin.moderation.hideWhy.toLowerCase()).toContain('put it back');
  });

  it('says what happens after a report, not just that it was received', () => {
    expect(en.community.reported.toLowerCase()).toContain('look at it');
  });

  /** Being refused for posting quickly is not an error the student caused. */
  it('handles the rate limit as a wait, not a failure', () => {
    expect(community).toContain('error.status === 429');
    expect(en.community.tooFast.toLowerCase()).toContain('try again');
    expect(en.community.tooFast.toLowerCase()).not.toContain('error');
  });

  it('takes its words from the dictionary rather than the file', () => {
    for (const code of [standing, community]) {
      const sentences = code.match(/>[A-Z][a-z]+ [a-z]{2,}[^<>{}]*</g) ?? [];
      expect(sentences, sentences.join(' | ')).toEqual([]);
    }
  });
});
