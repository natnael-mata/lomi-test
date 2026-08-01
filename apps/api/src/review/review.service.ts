import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { toAnswerView, type AnswerView } from '../questions/answer-view';

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

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

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
      answerView: toAnswerView(question),
      authorId: question.authorId,
      importFlags: question.importFlags,
      field: question.topic.course.field.name,
      course: question.topic.course.name,
      topic: question.topic.name,
      topicWeighted: question.topic.weightPct !== null,
      bounceNote: question.bounceNote,
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
  async bounce(id: string, note: string): Promise<{ id: string; status: string }> {
    const trimmed = note.trim();
    if (trimmed.length < MIN_BOUNCE_NOTE) {
      throw new BadRequestException(
        `A bounce note must say what is wrong — at least ${MIN_BOUNCE_NOTE} characters, got ${trimmed.length}.`,
      );
    }

    const question = await this.prisma.question.findUnique({ where: { id }, select: { id: true } });
    if (!question) throw new NotFoundException(`No question ${id}`);

    const updated = await this.prisma.question.update({
      where: { id },
      // Back to DRAFT: it is the author's again, and it must leave the review
      // queue immediately — otherwise the next reviewer picks up a question
      // somebody has already rejected.
      data: { status: 'DRAFT', bounceNote: trimmed },
    });
    return { id: updated.id, status: updated.status };
  }
}
