import { Injectable } from '@nestjs/common';

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
}

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
    };
  }
}
