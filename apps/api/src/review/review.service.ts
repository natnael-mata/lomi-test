import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { toAnswerView, type AnswerView } from '../questions/answer-view';
import { gateBlockers } from '../questions/publish-gate';
import { normalisePatch, type ReviewPatch } from './review-patch';

/**
 * A question waiting for review.
 *
 * The judgement itself is `answerView` — byte-for-byte the contract a student
 * gets after attempting (`answer-view.ts`). A reviewer approving something they
 * can see more of than the student can is approving a different question.
 *
 * Everything beside it is context for deciding, not content: who wrote it, where
 * it sits in the taxonomy, and what the import said was still missing.
 */
export interface ReviewItem {
  /**
   * The question this is.
   *
   * **Absent until T-231, which is why no screen could ever act on this.**
   * `next()` returned everything needed to *judge* a question and nothing that
   * could address it — so publish and bounce, which take an id in the path, had
   * no id to take. The queue was readable and not actionable, and that was
   * invisible for as long as the only caller was a test asserting the shape.
   */
  id: string;
  /** The human-readable handle. What a reviewer quotes when they ask about it. */
  stableId: string;
  answerView: AnswerView;
  authorId: string | null;
  importFlags: string[];
  field: string;
  course: string;
  topic: string;
  /** Whether the topic is weighted — a blocker the gate will raise (T-046). */
  topicWeighted: boolean;
  /** What a previous reviewer asked for, if this has been round before. */
  bounceNote: string | null;
  /**
   * Every reason the gate would refuse it right now.
   *
   * Sent with the item so the editor can close its own loop: a reviewer filling
   * in a why-wrong sees the blocker disappear on save, rather than finding out
   * by pressing publish and reading a refusal. The same list the queue carries
   * and the same function the publish button runs.
   */
  blockers: string[];
}

/**
 * The shortest bounce note worth sending.
 *
 * Ten characters is not a quality bar — it is a typo bar. "no" and "fix" send
 * the author back to a question with no idea what is wrong with it, and the
 * round trip costs more than the reviewer saved. Anything that clears this is
 * the reviewer's judgement, not the system's.
 */
export const MIN_BOUNCE_NOTE = 10;

/** One draft, with everything standing between it and a student. */
export interface QueueDraft {
  id: string;
  stableId: string;
  stem: string;
  qType: string;
  field: string;
  topic: string;
  status: string;
  /** What the importer could not resolve — `needs_answer`, `needs_explanation`. */
  importFlags: string[];
  /** Every reason the gate would refuse it, in the order a reviewer fixes them. */
  blockers: string[];
  updatedAt: string;
}

export interface ReviewQueue {
  counts: { draft: number; inReview: number; published: number; retired: number };
  /** Drafts and bounced rows, oldest first. Capped — see `queue()`. */
  drafts: QueueDraft[];
  /** How many exist beyond the cap, so the screen never implies it showed everything. */
  more: number;
}

/** How many drafts one page of the queue carries. */
const QUEUE_LIMIT = 50;

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The next question for this reviewer to look at, or `null` when the queue is
   * empty for them.
   *
   * **Oldest first**, by `updatedAt`. A queue that hands out the newest item
   * leaves the awkward questions at the bottom forever, and the awkward ones are
   * exactly the ones a student eventually reads.
   *
   * **Never your own question.** The publish gate already refuses a self-review
   * (T-044), but refusing at the end of the process wastes the reviewer's read;
   * skipping it here means it is never offered in the first place. The two are
   * not redundant — this is the queue being polite, the gate is the rule.
   */
  /**
   * What is in the bank and what is stopping it (T-231).
   *
   * **The gap this closes is not cosmetic.** Every imported row lands `DRAFT`,
   * correctly — nothing reaches a student without review. But `next()` only
   * serves `IN_REVIEW`, and nothing anywhere listed drafts, so a thousand
   * uploaded questions were invisible to every screen in the product and
   * reachable only with a database client. Content could be loaded and could
   * not be released.
   *
   * Each row carries **the gate's own blockers**, computed by the same pure
   * function the publish endpoint runs. That is the answer to the only question
   * somebody has after an upload — *what is missing* — and computing it here
   * rather than in the browser means the list cannot disagree with the button.
   *
   * `reviewerId` is passed into the gate so the self-review rule (T-044) reports
   * against the person actually looking: a question you wrote yourself is
   * blocked for you and not for your colleague, and a list that says otherwise
   * sends somebody hunting for a fault that is not there.
   */
  async queue(reviewerId: string): Promise<ReviewQueue> {
    const [draft, inReview, published, retired] = await Promise.all([
      this.prisma.question.count({ where: { status: 'DRAFT' } }),
      this.prisma.question.count({ where: { status: 'IN_REVIEW' } }),
      this.prisma.question.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.question.count({ where: { status: 'RETIRED' } }),
    ]);

    const rows = await this.prisma.question.findMany({
      where: { status: 'DRAFT' },
      // Oldest first: the row that has been waiting longest is the one owed an
      // answer, which is the same rule the payment queue uses.
      orderBy: { updatedAt: 'asc' },
      take: QUEUE_LIMIT,
      include: {
        options: { orderBy: { label: 'asc' } },
        steps: { orderBy: { stepNo: 'asc' } },
        topic: { include: { course: { include: { field: true } } } },
      },
    });

    return {
      counts: { draft, inReview, published, retired },
      drafts: rows.map((question) => ({
        id: question.id,
        stableId: question.stableId,
        stem: question.stem,
        qType: question.qType,
        field: question.topic.course.field.name,
        topic: question.topic.name,
        status: question.status,
        importFlags: question.importFlags,
        blockers: gateBlockers({
          qType: question.qType,
          stem: question.stem,
          conceptLine: question.conceptLine,
          explanation: question.explanation,
          timeLimitSec: question.timeLimitSec,
          authorId: question.authorId,
          reviewerId,
          topic: {
            name: question.topic.name,
            weightPct: question.topic.weightPct?.toNumber() ?? null,
          },
          steps: question.steps.map((step) => ({
            stepNo: step.stepNo,
            text: step.text,
            formula: step.formula,
          })),
          options: question.options.map((option) => ({
            label: option.label,
            text: option.text,
            isCorrect: option.isCorrect,
            whyWrong: option.whyWrong,
          })),
        }),
        updatedAt: question.updatedAt.toISOString(),
      })),
      more: Math.max(0, draft - rows.length),
    };
  }

  async next(reviewerId: string): Promise<ReviewItem | null> {
    const question = await this.prisma.question.findFirst({
      where: {
        status: 'IN_REVIEW',
        // Spelled out as an OR rather than `NOT: { authorId: reviewerId }`.
        // That form compiles to `NOT (authorId = $1)`, which is NULL — not true
        // — for an unattributed question, so every author-less row silently
        // vanished from every queue. An unattributed question is nobody's own
        // work; it belongs in everyone's.
        OR: [{ authorId: null }, { authorId: { not: reviewerId } }],
      },
      orderBy: { updatedAt: 'asc' },
      include: {
        options: { orderBy: { label: 'asc' } },
        steps: { orderBy: { stepNo: 'asc' } },
        topic: { include: { course: { include: { field: true } } } },
      },
    });
    if (!question) return null;

    return {
      id: question.id,
      stableId: question.stableId,
      answerView: toAnswerView(question),
      authorId: question.authorId,
      importFlags: question.importFlags,
      field: question.topic.course.field.name,
      course: question.topic.course.name,
      topic: question.topic.name,
      topicWeighted: question.topic.weightPct !== null,
      bounceNote: question.bounceNote,
      blockers: gateBlockers({
        qType: question.qType,
        stem: question.stem,
        conceptLine: question.conceptLine,
        explanation: question.explanation,
        timeLimitSec: question.timeLimitSec,
        authorId: question.authorId,
        // The person looking, so the self-review rule (T-044) reports against
        // them: a question you wrote is blocked for you and not for a colleague.
        reviewerId,
        topic: {
          name: question.topic.name,
          weightPct: question.topic.weightPct?.toNumber() ?? null,
        },
        steps: question.steps.map((step) => ({
          stepNo: step.stepNo,
          text: step.text,
          formula: step.formula,
        })),
        options: question.options.map((option) => ({
          label: option.label,
          text: option.text,
          isCorrect: option.isCorrect,
          whyWrong: option.whyWrong,
        })),
      }),
    };
  }

  /**
   * Sends a question back to its author with a note.
   *
   * The note is required because a bounce without one is not a review — the
   * author receives "no" and has to guess. It is stored on the question as the
   * outstanding instruction rather than appended to a log, so the question can
   * always answer "what is still wrong with me"; the permanent record of who
   * bounced it and when is the audit log (T-069).
   */
  async bounce(id: string, note: string, actorId: string): Promise<{ id: string; status: string }> {
    const trimmed = note.trim();
    if (trimmed.length < MIN_BOUNCE_NOTE) {
      throw new BadRequestException(
        `A bounce note must say what is wrong — at least ${MIN_BOUNCE_NOTE} characters, got ${trimmed.length}.`,
      );
    }

    const question = await this.prisma.question.findUnique({
      where: { id },
      select: { id: true, stableId: true },
    });
    if (!question) throw new NotFoundException(`No question ${id}`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.question.update({
        where: { id },
        // Back to DRAFT: it is the author's again, and it must leave the review
        // queue immediately — otherwise the next reviewer picks up a question
        // somebody has already rejected.
        data: { status: 'DRAFT', bounceNote: trimmed },
      });
      // The note is copied into the log as well as onto the question. The column
      // is overwritten by the next bounce; the history has to survive it.
      await this.audit.record(
        {
          actorId,
          action: 'BOUNCED',
          questionId: row.id,
          stableId: row.stableId,
          detail: trimmed,
        },
        tx,
      );
      return row;
    });
    return { id: updated.id, status: updated.status };
  }

  /**
   * A reviewer authoring the answer content the import could not carry.
   *
   * This is the write path T-031a's decision depends on: why-wrongs and the
   * concept line are deliberately not columns in the import template, so without
   * this endpoint **nothing imported could ever be published**.
   *
   * Only the fields present in the body are touched. A patch that sent every
   * field would make two reviewers editing different parts of one question
   * overwrite each other, and the loser would never know.
   */
  async patch(
    id: string,
    body: ReviewPatch,
  ): Promise<{ id: string; status: string; changed: string[] }> {
    const result = normalisePatch(body);
    if (!result.ok) {
      throw new UnprocessableEntityException({
        error: 'INVALID_PATCH',
        reasons: result.reasons,
      });
    }
    const { patch } = result;

    const question = await this.prisma.question.findUnique({
      where: { id },
      select: { id: true, status: true, options: { select: { label: true } } },
    });
    if (!question) throw new NotFoundException(`No question ${id}`);

    const known = new Set(question.options.map((o) => o.label as string));
    const unknown = [
      ...(patch.correctOption && !known.has(patch.correctOption) ? [patch.correctOption] : []),
      ...patch.whyWrong.filter((w) => !known.has(w.label)).map((w) => w.label),
    ];
    if (unknown.length > 0) {
      throw new UnprocessableEntityException({
        error: 'INVALID_PATCH',
        reasons: [`This question has no option ${[...new Set(unknown)].join(', ')}.`],
      });
    }

    const changed: string[] = [];

    if (patch.correctOption !== undefined) {
      // Cleared first, then set: two correct options is a state the gate rejects
      // and the answer view cannot render, so it must not exist even briefly.
      await this.prisma.option.updateMany({
        where: { questionId: id, isCorrect: true },
        data: { isCorrect: false },
      });
      await this.prisma.option.update({
        where: { questionId_label: { questionId: id, label: patch.correctOption } },
        data: { isCorrect: true },
      });
      changed.push(`correct option = ${patch.correctOption}`);
    }

    for (const { label, value } of patch.whyWrong) {
      await this.prisma.option.update({
        where: { questionId_label: { questionId: id, label } },
        data: { whyWrong: value },
      });
      changed.push(value === null ? `cleared why-wrong ${label}` : `why-wrong ${label}`);
    }

    if (patch.steps !== undefined) {
      // Replaced wholesale, unlike options: steps have no identity of their own
      // beyond their order, and half-updated working is worse than none.
      await this.prisma.step.deleteMany({ where: { questionId: id } });
      if (patch.steps.length > 0) {
        await this.prisma.step.createMany({
          data: patch.steps.map((s) => ({ questionId: id, ...s })),
        });
      }
      changed.push(`${patch.steps.length} step(s)`);
    }

    const fields: Record<string, unknown> = {};
    if (patch.conceptLine !== undefined) {
      fields.conceptLine = patch.conceptLine;
      changed.push('concept line');
    }
    if (patch.explanation !== undefined) {
      fields.explanation = patch.explanation;
      changed.push('explanation');
    }
    if (patch.timeLimitSec !== undefined) {
      fields.timeLimitSec = patch.timeLimitSec;
      changed.push('time limit');
    }

    // Editing a PUBLISHED question sends it back to review — the same rule the
    // importer follows (T-054). What is live no longer matches what was
    // approved, so it stops being served until somebody approves it again.
    if (question.status === 'PUBLISHED') {
      fields.status = 'IN_REVIEW';
      changed.push('sent back to review — a published question was edited');
    }

    const updated = await this.prisma.question.update({ where: { id }, data: fields });
    return { id: updated.id, status: updated.status, changed };
  }

  /**
   * Puts a question into the review queue and clears the note that sent it back.
   *
   * The clearing is the point: `bounceNote` is a live instruction, and leaving a
   * stale one attached shows the next reviewer a complaint about a fix that has
   * already been made.
   */
  async submit(id: string): Promise<{ id: string; status: string }> {
    const question = await this.prisma.question.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!question) throw new NotFoundException(`No question ${id}`);

    if (question.status === 'PUBLISHED' || question.status === 'RETIRED') {
      throw new BadRequestException(
        `A ${question.status} question cannot be submitted for review; retire or edit it first.`,
      );
    }

    const updated = await this.prisma.question.update({
      where: { id },
      data: { status: 'IN_REVIEW', bounceNote: null },
    });
    return { id: updated.id, status: updated.status };
  }
}
