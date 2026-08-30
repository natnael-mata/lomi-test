/**
 * Threads, replies and reports (T-195, T-196, T-197).
 *
 * The rules with judgement in them live in `community.ts`, without a database.
 * What is here is the part that needs one: scoping reads so a student never sees
 * another programme's threads, stamping a reply with the role its author held
 * **at the time**, and keeping a report from being a delete button.
 */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  checkPost,
  isReportReason,
  isVerifiedAuthor,
  type AuthorRole,
  type ReportReason,
} from './community';
import { RateLimitService } from '../common/rate-limit.service';

export interface ThreadSummary {
  id: string;
  title: string;
  topicId: string;
  replies: number;
  /** Display name only — the same rule the leaderboard follows (T-193). */
  authorName: string;
  authorVerified: boolean;
  createdAt: string;
  /**
   * The topic this sits under, by name (T-268).
   *
   * The topic page's heading was the constant "Ask about this topic", so a
   * student who had opened one of four rooms could not tell which one they were
   * in — and neither could anybody reading a screenshot of it.
   */
  topicName: string;
  /**
   * Whether the asker wrote it, the same flag replies already carry (T-268).
   *
   * Needed once the opening question became reportable: the control is hidden
   * on your own question, because reporting yourself is not something anybody
   * wants to do and a moderator's queue is the wrong place to withdraw a post.
   */
  isYours: boolean;
  /** True once an operator has hidden it. Only its own author can see it then. */
  hidden: boolean;
}

export interface PostView {
  id: string;
  body: string;
  authorName: string;
  /** T-196: the product vouches for this reply. */
  verified: boolean;
  isYours: boolean;
  hidden: boolean;
  createdAt: string;
}

export interface ThreadView extends ThreadSummary {
  body: string;
  posts: PostView[];
}

/**
 * A reported post, as the moderation queue shows it (T-197).
 *
 * The post's text is included rather than linked: an operator deciding whether
 * to hide something has to read it, and a queue that makes them click through
 * to find out what they are ruling on is a queue that gets rubber-stamped.
 *
 * **Who reported it is deliberately absent.** The operator's job is to judge the
 * post, and knowing which student complained invites judging the complainer —
 * it is also the fact most likely to get somebody in trouble in a classroom.
 */
export interface ReportedPost {
  id: string;
  /** Null when the report is against an opening question rather than a reply. */
  postId: string | null;
  /** Null when the report is against a reply rather than an opening question. */
  threadId: string | null;
  reason: string;
  note: string | null;
  createdAt: string;
  /**
   * The opening question, when that is what was reported (T-268).
   *
   * Exactly one of `post` and `thread` is set, matching the CHECK constraint on
   * the table. Two fields rather than one blurred "content" because a moderator
   * hiding a question removes the whole discussion under it, and the screen has
   * to be able to say so.
   */
  thread: {
    id: string;
    title: string;
    body: string;
    hiddenAt: string | null;
    authorName: string | null;
    topicName: string | null;
    replyCount: number;
  } | null;
  post: {
    id: string;
    body: string;
    hiddenAt: string | null;
    threadId: string;
    /**
     * Who wrote it, and where.
     *
     * Added because the row was the post's text and nothing else, which is not
     * enough to rule on it: whether a reply is abuse or a blunt correction can
     * depend on the question it answers, and a moderator with no thread to open
     * is deciding on a fragment. Display names only — the same handle every
     * other student sees.
     */
    authorName: string | null;
    threadTitle: string | null;
    topicName: string | null;
  } | null;
}

/** A post an operator has hidden, and enough context to decide to put it back. */
export interface HiddenPost {
  /**
   * Whether this is a reply or a whole question.
   *
   * Restore goes to a different endpoint for each, and hiding a question takes
   * its answers down with it — so the screen has to be able to say which one it
   * is offering to put back.
   */
  kind: 'post' | 'thread';
  id: string;
  body: string;
  hiddenAt: string;
  hiddenNote: string | null;
  threadId: string;
  threadTitle: string | null;
  topicName: string | null;
  authorName: string | null;
}

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /**
   * Threads under one topic (T-195).
   *
   * Scoped by `topicId` **and** by the field the caller is actually studying. A
   * topic id is guessable, and scoping on it alone would let anybody read any
   * programme's discussion by typing a different id.
   */
  async threadsForTopic(viewerId: string, topicId: string): Promise<ThreadSummary[]> {
    const fieldId = await this.fieldOf(viewerId);
    const threads = await this.prisma.thread.findMany({
      where: {
        topicId,
        fieldId,
        // A hidden thread is gone for everybody but its author (T-197).
        OR: [{ hiddenAt: null }, { authorId: viewerId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        /*
         * Visible replies, not every row (T-268).
         *
         * A bare `_count: { posts: true }` counts hidden ones, so a thread whose
         * only reply had been hidden still advertised "1 reply · User C" and
         * opened onto nothing. The list was promising something the thread no
         * longer had, which is the one thing a count on a link must not do.
         *
         * Hidden-for-everybody-but-the-author is the rule inside a thread, but
         * this number is read from outside one — so it counts what a passer-by
         * would find, and the author sees their own hidden reply on opening it.
         */
        _count: { select: { posts: { where: { hiddenAt: null } } } },
      },
    });

    const names = await this.namesFor(threads.map((t) => t.authorId));
    const roles = await this.rolesFor(threads.map((t) => t.authorId));
    // One lookup for the whole list — every thread here is in the same topic.
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { name: true },
    });

    return threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      topicId: thread.topicId,
      topicName: topic?.name ?? '',
      replies: thread._count.posts,
      authorName: names.get(thread.authorId) ?? '',
      authorVerified: isVerifiedAuthor(roles.get(thread.authorId) ?? 'STUDENT'),
      createdAt: thread.createdAt.toISOString(),
      isYours: thread.authorId === viewerId,
      hidden: thread.hiddenAt !== null,
    }));
  }

  /** Opens a thread. The field is taken from the topic, never from the caller. */
  async openThread(
    authorId: string,
    topicId: string,
    title: string,
    body: string,
  ): Promise<{ id: string }> {
    await this.guardRate(authorId);
    const check = checkPost({ body });
    if (!check.ok) throw new ForbiddenException({ error: check.error, message: check.message });

    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { course: { select: { fieldId: true } } },
    });
    if (!topic) throw new NotFoundException('No such topic.');

    const fieldId = topic.course.fieldId;
    // A student may only start a thread in the programme they are studying.
    // Anything else is posting into a room they cannot read.
    if (fieldId !== (await this.fieldOf(authorId))) {
      throw new ForbiddenException({
        error: 'WRONG_FIELD',
        message: 'That topic belongs to another programme. Choose one from your own.',
      });
    }

    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new ForbiddenException({
        error: 'TITLE_REQUIRED',
        message: 'Give your question a title so somebody can find it.',
      });
    }

    return this.prisma.thread.create({
      data: { topicId, fieldId, authorId, title: trimmed, body: check.body },
      select: { id: true },
    });
  }

  async threadFor(viewerId: string, threadId: string): Promise<ThreadView> {
    const fieldId = await this.fieldOf(viewerId);
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      include: { posts: { orderBy: { createdAt: 'asc' } } },
    });

    // Not found and not yours to read are the same answer, so a wrong field
    // cannot be used to discover which threads exist.
    if (!thread || thread.fieldId !== fieldId) throw new NotFoundException('No such thread.');
    if (thread.hiddenAt !== null && thread.authorId !== viewerId) {
      throw new NotFoundException('No such thread.');
    }

    const authorIds = [thread.authorId, ...thread.posts.map((p) => p.authorId)];
    const names = await this.namesFor(authorIds);
    const roles = await this.rolesFor([thread.authorId]);
    const topic = await this.prisma.topic.findUnique({
      where: { id: thread.topicId },
      select: { name: true },
    });

    return {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      topicId: thread.topicId,
      topicName: topic?.name ?? '',
      replies: thread.posts.length,
      authorName: names.get(thread.authorId) ?? '',
      authorVerified: isVerifiedAuthor(roles.get(thread.authorId) ?? 'STUDENT'),
      createdAt: thread.createdAt.toISOString(),
      isYours: thread.authorId === viewerId,
      // Only its author can reach a hidden thread at all — the guard above
      // throws for everybody else — so this always means "yours, and hidden".
      hidden: thread.hiddenAt !== null,
      posts: thread.posts
        .filter((post) => post.hiddenAt === null || post.authorId === viewerId)
        .map((post) => ({
          id: post.id,
          body: post.body,
          authorName: names.get(post.authorId) ?? '',
          // Read from the row, not from the author's role today (T-196).
          verified: isVerifiedAuthor(post.authorRole as AuthorRole),
          isYours: post.authorId === viewerId,
          hidden: post.hiddenAt !== null,
          createdAt: post.createdAt.toISOString(),
        })),
    };
  }

  /**
   * Replies to a thread (T-196).
   *
   * The author's role is **stamped onto the row**. A reply that carried the
   * product's word when it was written should keep carrying it after the
   * reviewer moves on — and a student later made a reviewer should not have
   * their old guesses retroactively endorsed.
   */
  async reply(authorId: string, threadId: string, body: string): Promise<{ id: string }> {
    await this.guardRate(authorId);
    const check = checkPost({ body });
    if (!check.ok) throw new ForbiddenException({ error: check.error, message: check.message });

    // Reuses the read guard, so replying is possible exactly where reading is.
    await this.threadFor(authorId, threadId);

    const role = (await this.rolesFor([authorId])).get(authorId) ?? 'STUDENT';
    return this.prisma.post.create({
      data: { threadId, authorId, authorRole: role, body: check.body },
      select: { id: true },
    });
  }

  /**
   * Flags a post for a person to look at (T-197).
   *
   * **Hides nothing.** One report is one person's opinion, and a product where a
   * single tap removes another student's question has handed every argument to
   * whoever reports first. The unique constraint makes a second tap a no-op
   * rather than a second entry in the queue.
   */
  async report(
    reporterId: string,
    postId: string,
    reason: string,
    note?: string,
  ): Promise<{ queued: true }> {
    if (!isReportReason(reason)) {
      throw new ForbiddenException({
        error: 'REASON_REQUIRED',
        message: 'Choose why you are reporting this so somebody can look at the right thing.',
      });
    }

    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('No such post.');

    await this.prisma.report.upsert({
      where: { postId_reporterId: { postId, reporterId } },
      update: { reason, note: note?.trim() || null },
      create: { postId, reporterId, reason: reason as ReportReason, note: note?.trim() || null },
    });
    return { queued: true };
  }

  /**
   * Reports the opening question rather than a reply (T-268).
   *
   * **The most visible thing in a topic was the one thing nobody could
   * report.** `Report` referenced `Post`, and a thread's opening question is a
   * `Thread` row — so the Report control appeared under every reply and never
   * under the question they were all answering. An abusive or off-topic
   * question stayed up because there was no way to raise it.
   *
   * Deliberately the same shape as `report`: one reason from the fixed set, one
   * report per person, hides nothing on its own. A second route rather than a
   * second meaning for `postId`, because the caller knows which one it has.
   */
  async reportThread(
    reporterId: string,
    threadId: string,
    reason: string,
    note?: string,
  ): Promise<{ queued: true }> {
    if (!isReportReason(reason)) {
      throw new ForbiddenException({
        error: 'REASON_REQUIRED',
        message: 'Choose why you are reporting this so somebody can look at the right thing.',
      });
    }

    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('No such question.');

    await this.prisma.report.upsert({
      where: { threadId_reporterId: { threadId, reporterId } },
      update: { reason, note: note?.trim() || null },
      create: { threadId, reporterId, reason: reason as ReportReason, note: note?.trim() || null },
    });
    return { queued: true };
  }

  /** The moderation queue: reported posts nobody has looked at yet. */
  async pendingReports(limit = 50): Promise<ReportedPost[]> {
    const rows = await this.prisma.report.findMany({
      where: { reviewedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        post: {
          select: {
            id: true,
            body: true,
            hiddenAt: true,
            threadId: true,
            authorId: true,
            thread: { select: { title: true, topicId: true } },
          },
        },
        thread: {
          select: {
            id: true,
            title: true,
            body: true,
            hiddenAt: true,
            topicId: true,
            authorId: true,
            // What hiding this would take down with it. A moderator removing a
            // question removes every answer under it, and that is a bigger act
            // than hiding one reply — the number is how they can tell.
            _count: { select: { posts: { where: { hiddenAt: null } } } },
          },
        },
      },
    });

    const names = await this.namesFor(
      rows.flatMap((row) => [
        ...(row.post ? [row.post.authorId] : []),
        ...(row.thread ? [row.thread.authorId] : []),
      ]),
    );
    const topics = await this.prisma.topic.findMany({
      where: {
        id: {
          in: [
            ...new Set(
              rows.flatMap((row) => [
                ...(row.post ? [row.post.thread.topicId] : []),
                ...(row.thread ? [row.thread.topicId] : []),
              ]),
            ),
          ],
        },
      },
      select: { id: true, name: true },
    });
    const topicName = new Map(topics.map((topic) => [topic.id, topic.name]));

    /*
     * Mapped to a declared shape rather than returned raw.
     *
     * `findMany` with an `include` returns whatever the row happens to hold, so
     * a column added to `Report` would start appearing on the wire without
     * anybody deciding it should — and `reportedBy` is on that table. Naming
     * the shape also gives `contracts.test.ts` something to hold the client's
     * copy against, which raw Prisma output cannot.
     */
    return rows.map((row) => ({
      id: row.id,
      postId: row.postId,
      threadId: row.threadId,
      reason: row.reason,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      thread: row.thread
        ? {
            id: row.thread.id,
            title: row.thread.title,
            body: row.thread.body,
            hiddenAt: row.thread.hiddenAt?.toISOString() ?? null,
            authorName: names.get(row.thread.authorId) ?? null,
            topicName: topicName.get(row.thread.topicId) ?? null,
            replyCount: row.thread._count.posts,
          }
        : null,
      post: row.post
        ? {
            id: row.post.id,
            body: row.post.body,
            hiddenAt: row.post.hiddenAt?.toISOString() ?? null,
            threadId: row.post.threadId,
            authorName: names.get(row.post.authorId) ?? null,
            threadTitle: row.post.thread.title,
            topicName: topicName.get(row.post.thread.topicId) ?? null,
          }
        : null,
    }));
  }

  /**
   * Everything currently hidden, so hiding can be undone (T-268).
   *
   * **Restore had no screen it could ever appear on.** Hiding a post settles its
   * report, and the queue is `reviewedAt: null` — so the row left the queue at
   * the exact moment the restore button became relevant. The endpoint existed,
   * the button existed, and the only path to it was a report that no longer
   * matched the query. A moderator who mis-clicked had no way back, under a
   * caption promising "you can put it back".
   *
   * Keyed on the post being hidden rather than on a report, deliberately: what a
   * moderator needs to audit is what students cannot currently see, and that is
   * a fact about posts. Sorted newest-hidden first, because a mistake is
   * noticed straight after it is made.
   */
  async hiddenPosts(limit = 50): Promise<HiddenPost[]> {
    const rows = await this.prisma.post.findMany({
      where: { hiddenAt: { not: null } },
      orderBy: { hiddenAt: 'desc' },
      take: limit,
      select: {
        id: true,
        body: true,
        hiddenAt: true,
        hiddenNote: true,
        threadId: true,
        authorId: true,
        // `Thread.topicId` is a plain column — there is no relation to follow,
        // so the topic names are fetched in one go below rather than per row.
        thread: { select: { title: true, topicId: true } },
      },
    });

    const names = await this.namesFor(rows.map((row) => row.authorId));
    const topics = await this.prisma.topic.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.thread.topicId))] } },
      select: { id: true, name: true },
    });
    const topicName = new Map(topics.map((topic) => [topic.id, topic.name]));

    /*
     * Hidden questions belong in the same list as hidden replies.
     *
     * They are hidden by the same operator for the same reasons, and a
     * moderator asking "what can students not see" does not care which table it
     * came from. `kind` is what the screen needs to send Restore to the right
     * endpoint.
     */
    const threads = await this.prisma.thread.findMany({
      where: { hiddenAt: { not: null } },
      orderBy: { hiddenAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        hiddenAt: true,
        hiddenNote: true,
        topicId: true,
        authorId: true,
      },
    });
    const threadNames = await this.namesFor(threads.map((thread) => thread.authorId));
    const threadTopics = await this.prisma.topic.findMany({
      where: { id: { in: [...new Set(threads.map((thread) => thread.topicId))] } },
      select: { id: true, name: true },
    });
    const threadTopicName = new Map(threadTopics.map((topic) => [topic.id, topic.name]));

    const hidden: HiddenPost[] = [
      ...rows.map((row) => ({
        kind: 'post' as const,
        id: row.id,
        body: row.body,
        hiddenAt: row.hiddenAt!.toISOString(),
        hiddenNote: row.hiddenNote,
        threadId: row.threadId,
        threadTitle: row.thread.title,
        topicName: topicName.get(row.thread.topicId) ?? null,
        authorName: names.get(row.authorId) ?? null,
      })),
      ...threads.map((thread) => ({
        kind: 'thread' as const,
        id: thread.id,
        body: thread.body,
        hiddenAt: thread.hiddenAt!.toISOString(),
        hiddenNote: thread.hiddenNote,
        threadId: thread.id,
        threadTitle: thread.title,
        topicName: threadTopicName.get(thread.topicId) ?? null,
        authorName: threadNames.get(thread.authorId) ?? null,
      })),
    ];

    // Newest-hidden first across both, because a mistake is noticed straight
    // after it is made and the operator does not think in tables.
    return hidden.sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt)).slice(0, limit);
  }

  /** An operator hides a post, or puts it back. This is the only thing that hides one. */
  async setPostHidden(
    postId: string,
    actorId: string,
    hidden: boolean,
    note?: string,
  ): Promise<{ hidden: boolean }> {
    await this.prisma.post.update({
      where: { id: postId },
      data: hidden
        ? { hiddenAt: new Date(), hiddenBy: actorId, hiddenNote: note?.trim() || null }
        : { hiddenAt: null, hiddenBy: null, hiddenNote: null },
    });
    await this.prisma.report.updateMany({
      where: { postId, reviewedAt: null },
      data: { reviewedAt: new Date(), reviewedBy: actorId },
    });
    return { hidden };
  }

  /**
   * The same, for an opening question (T-268).
   *
   * `Thread` has carried `hiddenAt`/`hiddenBy`/`hiddenNote` since T-197 and the
   * read path already honours it — a hidden thread is gone for everybody but its
   * author. Nothing ever set it, because nothing could report a thread in the
   * first place.
   *
   * Hiding a question takes its answers down with it, which is why the queue
   * shows the reply count beside it. That is a property of the read path, not
   * something to enforce here: the replies stay in the database and come back
   * with the question.
   */
  async setThreadHidden(
    threadId: string,
    actorId: string,
    hidden: boolean,
    note?: string,
  ): Promise<{ hidden: boolean }> {
    await this.prisma.thread.update({
      where: { id: threadId },
      data: hidden
        ? { hiddenAt: new Date(), hiddenBy: actorId, hiddenNote: note?.trim() || null }
        : { hiddenAt: null, hiddenBy: null, hiddenNote: null },
    });
    await this.prisma.report.updateMany({
      where: { threadId, reviewedAt: null },
      data: { reviewedAt: new Date(), reviewedBy: actorId },
    });
    return { hidden };
  }

  /**
   * Two windows, not one (T-197).
   *
   * Five a minute stops a flood; forty an hour stops a slow one. Somebody
   * answering three classmates quickly is not the failure being prevented, and a
   * limit that catches ordinary enthusiasm gets worked around rather than
   * respected.
   */
  private async guardRate(userId: string): Promise<void> {
    this.rateLimit.consume('communityPost', userId, null);
    this.rateLimit.consume('communityPostHourly', userId, null);
  }

  private async fieldOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    if (!user?.fieldId) {
      throw new ForbiddenException({
        error: 'FIELD_REQUIRED',
        message: 'Choose a programme before joining the discussion.',
      });
    }
    return user.fieldId;
  }

  private async namesFor(ids: string[]): Promise<Map<string, string>> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      // Display name only. A community surface is public to every other student.
      select: { id: true, displayName: true },
    });
    return new Map(users.map((u) => [u.id, u.displayName]));
  }

  private async rolesFor(ids: string[]): Promise<Map<string, AuthorRole>> {
    const staff = await this.prisma.staffMember.findMany({
      where: { userId: { in: [...new Set(ids)] } },
      select: { userId: true, role: true },
    });
    return new Map(staff.map((s) => [s.userId, s.role as AuthorRole]));
  }
}
