import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { toAnswerView, type AnswerView } from '../questions/answer-view';
import {
  freeRemaining,
  pacingFor,
  validateSubmission,
  type AttemptSubmission,
  type Pacing,
} from './attempt-rules';
import { toServedQuestion, type ServedQuestion } from './question-view';
import { SUBSCRIPTION_ACCESS, type SubscriptionAccess } from './subscription-access';

/**
 * What a student gets back for answering.
 *
 * `answerView` is the SAME object a reviewer sees (`answer-view.ts`) — the
 * contract is shared so a reviewer cannot approve something a student will not
 * receive. Everything beside it is about this particular attempt.
 */
export interface AttemptResult {
  attemptId: string;
  isCorrect: boolean;
  /** Pacing is a separate axis from correctness; see `pacingFor`. */
  pacing: Pacing;
  timeTakenSec: number;
  timeLimitSec: number;
  /**
   * Free questions left in this field after this attempt, or `null` for a
   * subscriber.
   *
   * `null`, not `Infinity`: `JSON.stringify(Infinity)` is `null` anyway, so
   * returning it would have shipped the same value with none of the intent —
   * and a client doing arithmetic on it would get `NaN` instead of a clear
   * "there is no limit".
   */
  freeRemaining: number | null;
  /** Present when the submitted duration was unusable and had to be adjusted. */
  timeNote: string | null;
  answerView: AnswerView;
}

/**
 * 402 Payment Required, so a client can route straight to checkout.
 *
 * Built from `HttpException` because Nest ships no `PaymentRequiredException`.
 * The obvious substitutes are both wrong: 403 says "you may never do this", and
 * 422 says "your request was malformed" — this request was perfectly formed and
 * the answer is "not yet, and here is what to do about it".
 */
export class FreeLimitReached extends HttpException {
  constructor(remaining: number) {
    super({ error: 'FREE_LIMIT_REACHED', freeRemaining: remaining }, HttpStatus.PAYMENT_REQUIRED);
  }
}

@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SUBSCRIPTION_ACCESS) private readonly subscriptions: SubscriptionAccess,
  ) {}

  /**
   * The next question for this student to practise.
   *
   * Only `PUBLISHED`, only in their field. Both filters are on the row, not on
   * anything the caller sends — a field id in the request would let any student
   * read any programme's bank.
   *
   * Selection is **random among the eligible**, not "oldest first": a
   * deterministic order means every student in a field sees the same sequence,
   * which turns the bank into a shareable answer list. Randomness here is a
   * mild anti-sharing measure, not a pedagogy claim.
   */
  async next(userId: string): Promise<ServedQuestion> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    // The field gate (T-085) runs before this, so a null field means the guard
    // was not wired up — fail rather than serve from an arbitrary programme.
    if (!user?.fieldId) throw new NotFoundException('No programme chosen.');

    const eligible = await this.prisma.question.findMany({
      where: {
        fieldId: user.fieldId,
        status: 'PUBLISHED',
        // T-110: not one they have already got right today.
        NOT: {
          attempts: { some: { userId, isCorrect: true, createdAt: { gte: startOfToday() } } },
        },
      },
      select: { id: true },
    });

    if (eligible.length === 0) {
      throw new NotFoundException('Nothing left to practise in this programme today.');
    }

    const pick = eligible[Math.floor(Math.random() * eligible.length)]!;
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: pick.id },
      // Selected explicitly. `include: { options: true }` would carry
      // `isCorrect` and `whyWrong` out of the database, and the only thing
      // standing between that and the wire would be the mapper remembering.
      select: {
        id: true,
        stableId: true,
        qType: true,
        stem: true,
        codeBlock: true,
        timeLimitSec: true,
        topic: { select: { name: true } },
        options: { select: { label: true, text: true }, orderBy: { label: 'asc' } },
      },
    });

    return toServedQuestion(question);
  }

  /**
   * Records an answer and releases the explanation.
   *
   * This is the **only** place answer content reaches a student (T-106), and the
   * price of it is a recorded attempt: there is no way to read an explanation
   * without the answer being written down first, and every attempt counts
   * against the free allowance. That is what stops the endpoint being used to
   * walk the bank.
   */
  async attempt(userId: string, body: AttemptSubmission): Promise<AttemptResult> {
    const validated = validateSubmission(body);
    if (!validated.ok) {
      throw new UnprocessableEntityException({
        error: 'INVALID_ATTEMPT',
        reasons: validated.reasons,
      });
    }
    const { questionId, chosenLabel, timeTakenSec, timeNote } = validated.submission;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    if (!user?.fieldId) throw new NotFoundException('No programme chosen.');

    const question = await this.prisma.question.findFirst({
      // Scoped by field and status in the WHERE, not checked afterwards. A
      // question in another programme, or one that is not published, simply does
      // not exist to this student — the same 404 for both, because "that question
      // exists but is not yours" is itself information.
      where: { id: questionId, fieldId: user.fieldId, status: 'PUBLISHED' },
      include: {
        options: { orderBy: { label: 'asc' } },
        steps: { orderBy: { stepNo: 'asc' } },
      },
    });
    if (!question) throw new NotFoundException('No such question.');

    const chosen = question.options.find((o) => o.label === chosenLabel);
    if (!chosen) {
      throw new UnprocessableEntityException({
        error: 'INVALID_ATTEMPT',
        reasons: [`This question has no option ${chosenLabel}.`],
      });
    }

    const subscribed = await this.subscriptions.hasActiveSubscription(userId, user.fieldId);

    // Distinct questions, not attempts — re-answering one to re-read its
    // explanation has not consumed a new question.
    const attemptedIds = await this.prisma.attempt.findMany({
      where: { userId, fieldId: user.fieldId },
      select: { questionId: true },
      distinct: ['questionId'],
    });
    const alreadyAttempted = new Set(attemptedIds.map((a) => a.questionId));
    const isNewQuestion = !alreadyAttempted.has(question.id);

    if (!subscribed && isNewQuestion && freeRemaining(alreadyAttempted.size) === 0) {
      // Refused BEFORE the attempt is written and before any answer content is
      // read: a 402 that still returned the explanation would be a paywall you
      // can walk through.
      throw new FreeLimitReached(0);
    }

    const isCorrect = chosen.isCorrect;

    const attempt = await this.prisma.attempt.create({
      data: {
        userId,
        questionId: question.id,
        fieldId: question.fieldId,
        topicId: question.topicId,
        chosenLabel,
        // Resolved now, stored, never recomputed: if the question is corrected
        // later, this student's result stays what it was when they sat it.
        isCorrect,
        timeTakenSec,
      },
      select: { id: true },
    });

    const consumed = isNewQuestion ? alreadyAttempted.size + 1 : alreadyAttempted.size;

    return {
      attemptId: attempt.id,
      isCorrect,
      pacing: pacingFor(timeTakenSec, question.timeLimitSec, timeNote === null),
      timeTakenSec,
      timeLimitSec: question.timeLimitSec,
      freeRemaining: subscribed ? null : freeRemaining(consumed),
      timeNote,
      answerView: toAnswerView(question, chosenLabel),
    };
  }
}

/**
 * Midnight local time.
 *
 * "The same day" is the student's day, not UTC's. Ethiopia is UTC+3, so a UTC
 * boundary would reset a student's practice at 3am — mid-revision for exactly
 * the people cramming the night before.
 */
export function startOfToday(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}
