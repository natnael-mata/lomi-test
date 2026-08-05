import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { OptionLabel, Prisma } from '@prisma/client';

import { OPTION_LABELS } from '../import/map-row';
import { SUBSCRIPTION_ACCESS, type SubscriptionAccess } from '../practice/subscription-access';
import { toServedQuestion } from '../practice/question-view';
import { toAnswerView, type AnswerView } from '../questions/answer-view';
import { PrismaService } from '../prisma/prisma.service';
import { summariseExam, type TopicBreakdown } from './exam-summary';
import type { SittingItem, SittingManifest } from './exam-view';
import {
  acceptsAnswer,
  clockFor,
  closeReasonFor,
  deadlineFor,
  sittingState,
  type SittingClock,
} from './sitting-clock';

export interface StartResult {
  sittingId: string;
  examName: string;
  totalQuestions: number;
  /** True when an open sitting was rejoined rather than a new one begun. */
  resumed: boolean;
  clock: SittingClock;
}

export interface SittingResultView {
  sittingId: string;
  examName: string;
  closedAt: string;
  closeReason: string;
  scoreCorrect: number;
  answeredCount: number;
  totalQuestions: number;
  scorePct: number;
  /** Per-topic breakdown, costliest first (T-130). */
  topics: TopicBreakdown[];
  /** The topic to revise first, by weight × miss rate. Null if nothing was asked. */
  weakestTopic: string | null;
  /** Its id, so the practice CTA can target it (T-139). */
  weakestTopicId: string | null;
  items: { position: number; answerView: AnswerView }[];
}

/** 402, so a client can route to checkout — the same shape as the free tier's. */
export class ExamRequiresSubscription extends HttpException {
  constructor() {
    super(
      {
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'A full mock exam is part of a subscription.',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SUBSCRIPTION_ACCESS) private readonly subscriptions: SubscriptionAccess,
  ) {}

  /**
   * Starts a sitting, or rejoins the one already open.
   *
   * **Gated on a subscription**, once, here. A hundred-question mock is ten times
   * the free practice allowance, so leaving it open is a paywall bypass needing
   * no exploit. Charging at the *end* would be worse than not charging: the
   * student sits three hours and is then asked to pay.
   *
   * Also the sweeper. A sitting the student abandoned is closed here, in the same
   * transaction, before anything else — laziness triggered by their own next
   * action, which is the only moment it matters. There is no scheduler in this
   * project, and a `setTimeout` at start is silently dropped by every deploy
   * while staying green in a test process that never restarts.
   */
  async start(userId: string, sessionId: string, now: Date = new Date()): Promise<StartResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    if (!user?.fieldId) throw new NotFoundException('No programme chosen.');
    const fieldId = user.fieldId;

    if (!(await this.subscriptions.hasActiveSubscription(userId, fieldId))) {
      throw new ExamRequiresSubscription();
    }

    return this.prisma.$transaction(async (tx) => {
      const open = await tx.sitting.findFirst({
        where: { userId, fieldId, closedAt: null },
        select: { id: true, examId: true, startedAt: true, endsAt: true, closedAt: true },
      });

      if (open) {
        if (sittingState(open, now) === 'open') {
          // Rejoin. Emphatically NOT a fresh deadline: refresh-and-restart would
          // otherwise be an unlimited timer, which defeats T-122 without the
          // client clock being touched at all.
          const exam = await tx.exam.findUniqueOrThrow({ where: { id: open.examId } });
          const total = await tx.examQuestion.count({ where: { examId: exam.id } });
          return {
            sittingId: open.id,
            examName: exam.name,
            totalQuestions: total,
            resumed: true,
            clock: clockFor(open, exam.durationSec, now),
          };
        }
        await this.closeSitting(tx, open.id, closeReasonFor(open, now), now);
      }

      const exam = await tx.exam.findFirst({
        where: { fieldId, isActive: true },
        orderBy: { builtAt: 'desc' },
      });
      if (!exam) {
        throw new UnprocessableEntityException({
          error: 'NO_EXAM_AVAILABLE',
          message: 'No mock paper has been built for this programme yet.',
        });
      }

      const total = await tx.examQuestion.count({ where: { examId: exam.id } });
      const sitting = await tx.sitting.create({
        data: {
          userId,
          examId: exam.id,
          fieldId,
          // Both from ONE `now`, in the application. `@default(now())` would use
          // the database clock, and every DateTime here is TIMESTAMP(3) without a
          // zone — a Postgres session on Africa/Addis_Ababa would stamp the start
          // three hours from the deadline and expire the sitting instantly.
          startedAt: now,
          endsAt: deadlineFor(now, exam.durationSec),
          startedBySessionId: sessionId,
        },
      });

      return {
        sittingId: sitting.id,
        examName: exam.name,
        totalQuestions: total,
        resumed: false,
        clock: clockFor(sitting, exam.durationSec, now),
      };
    });
  }

  /** The paper's shape: where the student is and what is left. No question text. */
  async manifest(
    userId: string,
    sittingId: string,
    now: Date = new Date(),
  ): Promise<SittingManifest> {
    const { sitting, exam } = await this.load(userId, sittingId);
    const slots = await this.prisma.examQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { position: 'asc' },
      select: { position: true, questionId: true },
    });
    const answers = await this.prisma.sittingAnswer.findMany({
      where: { sittingId: sitting.id },
      select: { questionId: true, chosenLabel: true, isFlagged: true },
    });
    const byQuestion = new Map(answers.map((a) => [a.questionId, a]));

    const rows = slots.map((slot) => {
      const answer = byQuestion.get(slot.questionId);
      return {
        position: slot.position,
        answered: answer?.chosenLabel != null,
        flagged: answer?.isFlagged ?? false,
      };
    });

    return {
      sittingId: sitting.id,
      examName: exam.name,
      totalQuestions: slots.length,
      answeredCount: rows.filter((r) => r.answered).length,
      flaggedCount: rows.filter((r) => r.flagged).length,
      clock: clockFor(sitting, exam.durationSec, now),
      slots: rows,
    };
  }

  /** One question, with no answer content of any kind. */
  async item(
    userId: string,
    sittingId: string,
    position: number,
    now: Date = new Date(),
  ): Promise<SittingItem> {
    const { sitting, exam } = await this.load(userId, sittingId);
    const slot = await this.prisma.examQuestion.findFirst({
      where: { examId: exam.id, position },
      select: { questionId: true, position: true },
    });
    if (!slot) throw new NotFoundException('No such question on this paper.');

    // Selected explicitly — an `include` would carry isCorrect and whyWrong out
    // of the database on their way to a student mid-exam.
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: slot.questionId },
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

    const answer = await this.prisma.sittingAnswer.findUnique({
      where: { sittingId_questionId: { sittingId: sitting.id, questionId: slot.questionId } },
      select: { chosenLabel: true, isFlagged: true },
    });

    const total = await this.prisma.examQuestion.count({ where: { examId: exam.id } });

    return {
      position: slot.position,
      totalQuestions: total,
      question: toServedQuestion(question),
      chosenLabel: answer?.chosenLabel ?? null,
      flagged: answer?.isFlagged ?? false,
      clock: clockFor(sitting, exam.durationSec, now),
    };
  }

  /**
   * Records an answer, or a flag, or both.
   *
   * Late arrivals inside the grace window are **written and then the sitting
   * closes** — the student pressed the button in time and the packet was slow.
   * Past the grace they are refused, and the sitting still closes: either way the
   * row settles on the student's own next action rather than waiting for a job
   * that does not exist.
   */
  async answer(
    userId: string,
    sittingId: string,
    position: number,
    input: { chosenLabel?: unknown; isFlagged?: unknown },
    sessionId: string,
    now: Date = new Date(),
  ): Promise<{
    position: number;
    chosenLabel: string | null;
    flagged: boolean;
    clock: SittingClock;
  }> {
    const { sitting, exam } = await this.load(userId, sittingId);

    if (sitting.closedAt !== null) {
      throw new ConflictException({
        error: 'SITTING_CLOSED',
        message: 'This sitting has already been submitted.',
      });
    }

    const label = normaliseLabel(input.chosenLabel);
    if (label === 'invalid') {
      throw new UnprocessableEntityException({
        error: 'INVALID_ANSWER',
        reasons: [`chosenLabel "${String(input.chosenLabel)}" is not one of A, B, C, D.`],
      });
    }

    const slot = await this.prisma.examQuestion.findFirst({
      where: { examId: exam.id, position },
      select: { questionId: true },
    });
    if (!slot) throw new NotFoundException('No such question on this paper.');

    const stillAccepting = acceptsAnswer(sitting, now);
    const expired = now.getTime() > sitting.endsAt.getTime();

    if (!stillAccepting) {
      // Too late to write, but the row must not stay open: close it here, in the
      // same request that noticed, so the deadline cannot be read as still live.
      await this.closeSitting(this.prisma, sitting.id, 'EXPIRED', now);
      throw new ConflictException({
        error: 'SITTING_EXPIRED',
        message: 'The time ran out. Your earlier answers are safe.',
      });
    }

    const flagged = typeof input.isFlagged === 'boolean' ? input.isFlagged : undefined;

    await this.prisma.sittingAnswer.upsert({
      where: { sittingId_questionId: { sittingId: sitting.id, questionId: slot.questionId } },
      update: {
        ...(label !== undefined ? { chosenLabel: label, answeredAt: now } : {}),
        ...(flagged !== undefined ? { isFlagged: flagged } : {}),
        answeredBySessionId: sessionId,
      },
      create: {
        sittingId: sitting.id,
        questionId: slot.questionId,
        chosenLabel: label ?? null,
        isFlagged: flagged ?? false,
        answeredAt: label !== undefined ? now : null,
        answeredBySessionId: sessionId,
      },
    });

    if (expired) {
      // Written inside the grace window, and the time has gone.
      await this.closeSitting(this.prisma, sitting.id, 'EXPIRED', now);
    }

    const saved = await this.prisma.sittingAnswer.findUniqueOrThrow({
      where: { sittingId_questionId: { sittingId: sitting.id, questionId: slot.questionId } },
      select: { chosenLabel: true, isFlagged: true },
    });
    const fresh = await this.prisma.sitting.findUniqueOrThrow({ where: { id: sitting.id } });

    return {
      position,
      chosenLabel: saved.chosenLabel,
      flagged: saved.isFlagged,
      clock: clockFor(fresh, exam.durationSec, now),
    };
  }

  /** Ends the sitting and grades it. */
  async submit(
    userId: string,
    sittingId: string,
    now: Date = new Date(),
  ): Promise<SittingResultView> {
    const { sitting } = await this.load(userId, sittingId);
    if (sitting.closedAt === null) {
      await this.closeSitting(this.prisma, sitting.id, closeReasonFor(sitting, now), now);
    }
    return this.result(userId, sittingId);
  }

  /**
   * The full review, once the sitting has closed (T-129).
   *
   * Gated on `closedAt`, never on the clock. Between `endsAt` passing and the row
   * settling there is a window in which a clock check would hand over the answer
   * key while the student could still write answers.
   */
  async result(userId: string, sittingId: string): Promise<SittingResultView> {
    const { sitting, exam } = await this.load(userId, sittingId);
    if (sitting.closedAt === null) {
      throw new ConflictException({
        error: 'SITTING_OPEN',
        message: 'The answers unlock when the sitting is submitted.',
      });
    }

    const results = await this.prisma.sittingResult.findMany({
      where: { sittingId: sitting.id },
      orderBy: { id: 'asc' },
    });
    const slots = await this.prisma.examQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { position: 'asc' },
      select: { position: true, questionId: true },
    });
    const questions = await this.prisma.question.findMany({
      where: { id: { in: slots.map((s) => s.questionId) } },
      include: {
        options: { orderBy: { label: 'asc' } },
        steps: { orderBy: { stepNo: 'asc' } },
        topic: { select: { name: true, weightPct: true } },
      },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const chosenBy = new Map(results.map((r) => [r.questionId, r.chosenLabel]));

    const items = slots.map((slot) => ({
      position: slot.position,
      answerView: toAnswerView(byId.get(slot.questionId)!, chosenBy.get(slot.questionId) ?? null),
    }));

    const total = slots.length;
    const correct = sitting.scoreCorrect ?? 0;

    // The breakdown is built from the frozen grading rows, not from re-marking
    // the answers here. `isCorrect` was decided once, at close, against the key
    // as it stood then — recomputing it now would let a later edit to a question
    // change a sitting a student has already seen.
    const summary = summariseExam(
      slots.map((slot) => {
        const question = byId.get(slot.questionId)!;
        const graded = results.find((r) => r.questionId === slot.questionId);
        return {
          topicId: question.topicId,
          topic: question.topic?.name ?? 'Unsorted',
          weightPct: question.topic?.weightPct?.toNumber() ?? null,
          isCorrect: graded?.isCorrect ?? false,
        };
      }),
    );

    return {
      sittingId: sitting.id,
      examName: exam.name,
      closedAt: sitting.closedAt.toISOString(),
      closeReason: sitting.closeReason ?? 'SUBMITTED',
      scoreCorrect: correct,
      answeredCount: sitting.answeredCount ?? 0,
      totalQuestions: total,
      scorePct: total === 0 ? 0 : Math.round((correct / total) * 1000) / 10,
      topics: summary.topics,
      weakestTopic: summary.weakestTopic,
      weakestTopicId: summary.weakestTopicId,
      items,
    };
  }

  /**
   * Settles a sitting and grades every question on the paper.
   *
   * One transaction, and the grading rows are the ONLY place correctness is
   * written — while a sitting is open, `sittingResult.count()` is zero, which is
   * what makes "no answer content during a sitting" checkable as a count rather
   * than as an absence of leaks.
   */
  private async closeSitting(
    db: Prisma.TransactionClient | PrismaService,
    sittingId: string,
    reason: 'SUBMITTED' | 'EXPIRED',
    now: Date,
  ): Promise<void> {
    const sitting = await db.sitting.findUniqueOrThrow({ where: { id: sittingId } });
    if (sitting.closedAt !== null) return;

    const slots = await db.examQuestion.findMany({
      where: { examId: sitting.examId },
      select: { questionId: true, topicId: true },
    });
    const answers = await db.sittingAnswer.findMany({
      where: { sittingId },
      select: { questionId: true, chosenLabel: true },
    });
    const chosen = new Map(answers.map((a) => [a.questionId, a.chosenLabel]));

    const correctByQuestion = new Map(
      (
        await db.option.findMany({
          where: { questionId: { in: slots.map((s) => s.questionId) }, isCorrect: true },
          select: { questionId: true, label: true },
        })
      ).map((o) => [o.questionId, o.label]),
    );

    let scoreCorrect = 0;
    let answeredCount = 0;
    const rows = slots.map((slot) => {
      const picked = chosen.get(slot.questionId) ?? null;
      if (picked !== null) answeredCount += 1;
      const isCorrect = picked !== null && correctByQuestion.get(slot.questionId) === picked;
      if (isCorrect) scoreCorrect += 1;
      return {
        sittingId,
        questionId: slot.questionId,
        topicId: slot.topicId,
        chosenLabel: picked,
        isCorrect,
      };
    });

    await db.sittingResult.createMany({ data: rows, skipDuplicates: true });
    await db.sitting.update({
      where: { id: sittingId },
      data: { closedAt: now, closeReason: reason, scoreCorrect, answeredCount },
    });
  }

  /**
   * Loads a sitting that belongs to this student.
   *
   * `userId` is in the WHERE, not checked afterwards, and a sitting belonging to
   * somebody else gives the same 404 as one that does not exist. Omitting it here
   * is the single most likely implementation bug in this module: it would hand a
   * hundred answer views to a student still sitting.
   */
  private async load(userId: string, sittingId: string) {
    const sitting = await this.prisma.sitting.findFirst({ where: { id: sittingId, userId } });
    if (!sitting) throw new NotFoundException('No such sitting.');
    const exam = await this.prisma.exam.findUniqueOrThrow({ where: { id: sitting.examId } });
    return { sitting, exam };
  }
}

/** `undefined` = not supplied, `'invalid'` = supplied and wrong. */
function normaliseLabel(value: unknown): OptionLabel | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return 'invalid';
  const label = value.trim().toUpperCase();
  return (OPTION_LABELS as readonly string[]).includes(label) ? (label as OptionLabel) : 'invalid';
}
