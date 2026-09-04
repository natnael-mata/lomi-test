import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { CommunityService, type ThreadView, type TopicThreads } from './community.service';

/**
 * The student's side of the community (T-195, T-196, T-197).
 *
 * Every route reads the caller from the session and scopes to the programme
 * they are studying. A topic id is guessable, so scoping on it alone would let
 * anybody read another programme's discussion by typing a different one.
 */
@Controller('community')
@UseGuards(SessionGuard)
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  /** Threads under one topic, in the caller's own field (T-195). */
  @Get('topics/:topicId/threads')
  threads(@Req() req: AuthedRequest, @Param('topicId') topicId: string): Promise<TopicThreads> {
    return this.community.threadsForTopic(req.auth!.userId, topicId);
  }

  @Post('topics/:topicId/threads')
  open(
    @Req() req: AuthedRequest,
    @Param('topicId') topicId: string,
    @Body() body: { title?: string; body?: string },
  ): Promise<{ id: string }> {
    return this.community.openThread(
      req.auth!.userId,
      topicId,
      body?.title ?? '',
      body?.body ?? '',
    );
  }

  @Get('threads/:threadId')
  thread(@Req() req: AuthedRequest, @Param('threadId') threadId: string): Promise<ThreadView> {
    return this.community.threadFor(req.auth!.userId, threadId);
  }

  /** A reply. Carries a verified badge if a reviewer wrote it (T-196). */
  @Post('threads/:threadId/posts')
  reply(
    @Req() req: AuthedRequest,
    @Param('threadId') threadId: string,
    @Body() body: { body?: string },
  ): Promise<{ id: string }> {
    return this.community.reply(req.auth!.userId, threadId, body?.body ?? '');
  }

  /**
   * Flags a post for a person to look at (T-197).
   *
   * **Hides nothing on its own.** One report is one person's opinion, and a
   * product where a single tap removes another student's question has handed
   * every argument to whoever reports first.
   */
  @Post('posts/:postId/report')
  report(
    @Req() req: AuthedRequest,
    @Param('postId') postId: string,
    @Body() body: { reason?: string; note?: string },
  ): Promise<{ queued: true }> {
    return this.community.report(req.auth!.userId, postId, body?.reason ?? '', body?.note);
  }

  /**
   * Flags the opening question (T-268).
   *
   * A separate route because a thread is not a post — the Report control was on
   * replies only, so the most visible thing in a topic could not be raised with
   * anybody. Same reasons, same one-per-person rule, same "hides nothing on its
   * own".
   */
  @Post('threads/:threadId/report')
  reportThread(
    @Req() req: AuthedRequest,
    @Param('threadId') threadId: string,
    @Body() body: { reason?: string; note?: string },
  ): Promise<{ queued: true }> {
    return this.community.reportThread(req.auth!.userId, threadId, body?.reason ?? '', body?.note);
  }
}

/**
 * Moderation (T-197).
 *
 * ADMIN only and under `/admin`, so the route inventory test (T-107) keeps
 * holding. This is the only place a post is hidden — reporting queues, a person
 * decides.
 */
@Controller('admin/community')
@UseGuards(SessionGuard, AdminGuard)
export class AdminCommunityController {
  constructor(private readonly community: CommunityService) {}

  /** The queue: reported posts nobody has looked at yet. */
  @Get('reports')
  reports(@Query('limit') limit?: string) {
    return this.community.pendingReports(Math.min(Math.max(Number(limit) || 50, 1), 200));
  }

  /**
   * What is currently hidden, which is where Restore lives (T-268).
   *
   * Separate from the queue because hiding settles the report: the row leaves
   * `reports` the moment restoring it becomes the relevant action, so a screen
   * built only on the queue can never offer the undo its own copy promises.
   */
  @Get('hidden')
  hidden(@Query('limit') limit?: string) {
    return this.community.hiddenPosts(Math.min(Math.max(Number(limit) || 50, 1), 200));
  }

  @Post('posts/:postId/hide')
  hide(
    @Req() req: AuthedRequest,
    @Param('postId') postId: string,
    @Body() body: { note?: string },
  ): Promise<{ hidden: boolean }> {
    return this.community.setPostHidden(postId, req.auth!.userId, true, body?.note);
  }

  /** Puts it back. A moderation queue without an undo is one nobody trusts. */
  @Post('posts/:postId/restore')
  restore(
    @Req() req: AuthedRequest,
    @Param('postId') postId: string,
  ): Promise<{ hidden: boolean }> {
    return this.community.setPostHidden(postId, req.auth!.userId, false);
  }

  /**
   * The same pair for an opening question (T-268).
   *
   * `Thread.hiddenAt` has existed since T-197 and the read path has always
   * honoured it; nothing could ever set it, because nothing could report a
   * thread. Hiding one takes its replies out of view with it — they are not
   * deleted, and they come back when it does.
   */
  @Post('threads/:threadId/hide')
  hideThread(
    @Req() req: AuthedRequest,
    @Param('threadId') threadId: string,
    @Body() body: { note?: string },
  ): Promise<{ hidden: boolean }> {
    return this.community.setThreadHidden(threadId, req.auth!.userId, true, body?.note);
  }

  @Post('threads/:threadId/restore')
  restoreThread(
    @Req() req: AuthedRequest,
    @Param('threadId') threadId: string,
  ): Promise<{ hidden: boolean }> {
    return this.community.setThreadHidden(threadId, req.auth!.userId, false);
  }
}
