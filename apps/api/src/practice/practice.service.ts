import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { EngagementService } from '../engagement/engagement.service';
import { PrismaService } from '../prisma/prisma.service';
import { RULES } from '../engagement/points';
import { toAnswerView, type AnswerView } from '../questions/answer-view';
import {
  freeRemaining,
  pacingFor,
  validateSubmission,
  type AttemptSubmission,
  type Pacing,
} from './attempt-rules';
import { toServedQuestion, type ServedQuestion } from './question-view';
import { buildReasonCheck, isReasonCorrect, type ReasonCheck } from './reason-check';
import { SUBSCRIPTION_ACCESS, type SubscriptionAccess } from './subscription-access';
import { summarise, type PracticeSummary } from './summary';

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
  /**
   * The follow-up that decides whether this question is **beaten** (T-255).
   *
   * Present only on a correct answer to a question this student has not beaten
   * yet, and only where the content can carry one — a question with no concept
   * line or too few authored why-wrongs returns null rather than a check with
   * invented alternatives. Null means "not asked", which is not the same as
   * failed: the question simply stays unbeaten.
   */
  reasonCheck: ReasonCheck | null;
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

/**
 * The key the reason-check ids are derived from.
 *
 * Reuses `JWT_SECRET` deliberately: it is already required to boot, already
 * rotated as one, and adding a second secret to the deployment checklist for a
 * value that never leaves one request is a way to end up with a default. The
 * ids are lookup keys within a request, not claims a client may present.
 */
function reasonSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set.');
  return secret;
}

/** Fisher–Yates. Lives here so `reason-check.ts` stays pure and testable. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SUBSCRIPTION_ACCESS) private readonly subscriptions: SubscriptionAccess,
    private readonly engagement: EngagementService,
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

    /*
     * The allowance, worked out *before* the pick rather than on the way out.
     *
     * It used to be computed after, which meant a student with nothing left was
     * still served a fresh question: they read the stem, weighed four options,
     * chose one, pressed Check — and only then met the paywall, with no verdict
     * on the answer they had just committed to. QA read that as "the last free
     * question skips its feedback". The attempt route was right to refuse (an
     * explanation released on a refused attempt is a paywall you can walk
     * through); the mistake was offering the question at all.
     *
     * Already-attempted questions stay answerable, because re-practice costs
     * nothing — so the wall narrows the pick to those rather than closing the
     * screen, and only refuses when there is genuinely nothing left to answer.
     * Same two reads as before, moved earlier.
     */
    const subscribed = await this.subscriptions.hasActiveSubscription(userId, user.fieldId);
    const attempted = subscribed
      ? []
      : await this.prisma.attempt.findMany({
          where: { userId, fieldId: user.fieldId },
          select: { questionId: true },
          distinct: ['questionId'],
        });
    const remaining = subscribed ? null : freeRemaining(attempted.length);

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

    /*
     * What may be offered, which is not the same as what is eligible.
     *
     * **A free student is shown something new until there is nothing new left.**
     * This picked at random over everything eligible, which includes questions
     * already attempted — so a student with six free questions left was
     * regularly handed one they had already answered. Re-answering consumes
     * nothing, so the counter did not move, and from the far side of the screen
     * that is indistinguishable from a free tier that is not being enforced:
     * QA answered "an eleventh and a twelfth question" and watched the badge sit
     * frozen. Both were repeats. The limit was working; the picker was undoing
     * the evidence of it.
     *
     * Once the allowance is gone the rule inverts — only what they have already
     * seen, because re-practice is free and a new question is not (T-239).
     *
     * A subscriber keeps the unfiltered draw. For them a returning question is
     * revision rather than a wasted turn, and there is no counter to confuse.
     */
    const seen = new Set(attempted.map((a) => a.questionId));
    let offerable = eligible;
    if (remaining === 0) {
      offerable = eligible.filter((q) => seen.has(q.id));
    } else if (remaining !== null) {
      const unseen = eligible.filter((q) => !seen.has(q.id));
      if (unseen.length > 0) offerable = unseen;
    }
    if (offerable.length === 0) throw new FreeLimitReached(0);

    const pick = offerable[Math.floor(Math.random() * offerable.length)]!;
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

    return toServedQuestion(question, remaining, seen.has(question.id));
  }

  /**
   * Records whether they named the reason, and with it whether the question is
   * beaten (T-255).
   *
   * Scoped to the caller's own attempt — the id is in the path, so the
   * ownership check is the whole security of this route.
   *
   * **Answerable once.** Re-posting would let a student walk the options until
   * one took, which is a worse guess than the letter they already guessed. A
   * second post is refused rather than ignored, so a client that has lost track
   * is told rather than left believing the first answer was overwritten.
   */
  async recordReason(
    userId: string,
    attemptId: string,
    chosenId: unknown,
  ): Promise<{ attemptId: string; reasonCorrect: boolean; beaten: boolean }> {
    const chosen = typeof chosenId === 'string' ? chosenId.trim() : '';
    if (chosen === '') {
      throw new UnprocessableEntityException({
        error: 'INVALID_REASON',
        reasons: ['chosenId is required.'],
      });
    }

    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, userId },
      select: {
        id: true,
        isCorrect: true,
        reasonCorrect: true,
        question: { select: { conceptLine: true } },
      },
    });
    if (!attempt) throw new NotFoundException('No such attempt.');

    if (attempt.reasonCorrect !== null) {
      throw new ConflictException({
        error: 'REASON_ALREADY_ANSWERED',
        message: 'That question has already been answered.',
      });
    }

    /*
     * A reason on a wrong answer decides nothing.
     *
     * Refused rather than recorded: the check is only ever issued after a
     * correct answer, so a post against a wrong one is a client that has lost
     * its place or somebody probing. Storing it would put a `reasonCorrect` on
     * a row that can never be beaten and make the column mean two things.
     */
    if (!attempt.isCorrect) {
      throw new UnprocessableEntityException({
        error: 'INVALID_REASON',
        reasons: ['That answer was not correct, so there is no reason to name.'],
      });
    }

    const reasonCorrect = isReasonCorrect(
      reasonSecret(),
      attempt.id,
      attempt.question.conceptLine,
      chosen,
    );

    await this.prisma.attempt.update({
      where: { id: attempt.id },
      data: { reasonCorrect, reasonChoiceId: chosen },
    });

    // Beaten is exactly these two together, and this is the only place both are
    // known at once.
    return { attemptId: attempt.id, reasonCorrect, beaten: reasonCorrect };
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
    const isCorrect = chosen.isCorrect;
    // Captured before the closure: a narrowing established by an earlier guard
    // does not survive into a callback, and `fieldId` is non-null by here.
    const fieldId = user.fieldId;

    /*
     * Counting and writing are ONE step, serialised per student (T-269).
     *
     * **The paywall was a read, a decision, and then a write**, so six requests
     * fired at once all read "eight used" and all passed. Measured against the
     * running server: a student with two free questions left answered six, each
     * response cheerfully reporting `freeRemaining: 1`, and the account finished
     * on fourteen of ten. Nothing exotic is needed to do it — a flaky connection
     * that retries, or a student tapping fast on a slow network, gets there by
     * accident.
     *
     * The lock is on the student's own row, so two people practising never wait
     * on each other and one person's answers queue behind their own, which is
     * what they do anyway. A `SERIALIZABLE` transaction would also work and
     * would abort under contention; this makes the second request wait a few
     * milliseconds and then see the truth.
     *
     * The whole check lives inside, including the re-read of what has been
     * attempted — a count taken before the lock is a count that can be stale by
     * the time the lock is held, which is the bug wearing a hat.
     */
    const { attempt, alreadyAttempted, isNewQuestion } = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

        // Distinct questions, not attempts — re-answering one to re-read its
        // explanation has not consumed a new question.
        const attemptedIds = await tx.attempt.findMany({
          where: { userId, fieldId },
          select: { questionId: true },
          distinct: ['questionId'],
        });
        const seen = new Set(attemptedIds.map((a) => a.questionId));

        if (!subscribed && !seen.has(question.id) && freeRemaining(seen.size) === 0) {
          // Refused BEFORE the attempt is written and before any answer content
          // is read: a 402 that still returned the explanation would be a paywall
          // you can walk through.
          throw new FreeLimitReached(0);
        }

        const written = await tx.attempt.create({
          data: {
            userId,
            questionId: question.id,
            fieldId: question.fieldId,
            topicId: question.topicId,
            chosenLabel,
            // Resolved now, stored, never recomputed: if the question is
            // corrected later, this student's result stays what it was when they
            // sat it.
            isCorrect,
            timeTakenSec,
          },
          select: { id: true },
        });
        return { attempt: written, alreadyAttempted: seen, isNewQuestion: !seen.has(question.id) };
      },
    );

    /*
     * The points, and the day (T-190, T-191).
     *
     * **Nothing called `EngagementService` at all until 2026-08-19.** Points,
     * streaks, badges and the leaderboard were built, tested in isolation and
     * ticked complete, and no path in the product ever wrote a ledger row — so
     * Standing said "Points 0 · Nothing yet" to a student who had answered
     * fifty questions. Found in QA, by somebody answering questions and
     * watching the number not move.
     *
     * After the attempt is written, and never in front of it. A student's
     * answer is the thing that must not be lost; the ledger row is bookkeeping,
     * and bookkeeping that can refuse an answer is worse than bookkeeping that
     * is occasionally missing. A failure here is logged and swallowed —
     * swallowed *silently* is how this stayed broken, so it is logged.
     */
    try {
      await this.engagement.record(userId, RULES.ANSWERED);
      if (isCorrect) await this.engagement.record(userId, RULES.CORRECT);
      // Marks them active today: the streak measures returning, not volume, so
      // this is idempotent per day.
      await this.engagement.touch(userId);
    } catch (error) {
      new Logger('practice').error(
        `points not recorded for ${userId}: ${error instanceof Error ? error.message : error}`,
      );
    }

    /*
     * Asked once per question, and only while it is still worth asking.
     *
     * Not random. A student who has already beaten a question has proved the
     * reason once and being asked again is friction with nothing behind it; a
     * student who has not is exactly who the check is for. "Sometimes" in the
     * design becomes "until you have got it", which is the version a person can
     * predict and therefore trust.
     */
    let reasonCheck: ReasonCheck | null = null;
    if (isCorrect) {
      const beaten = await this.prisma.attempt.findFirst({
        where: { userId, questionId: question.id, isCorrect: true, reasonCorrect: true },
        select: { id: true },
      });
      if (!beaten) {
        reasonCheck = buildReasonCheck(reasonSecret(), attempt.id, question, shuffle);
      }
    }

    const consumed = isNewQuestion ? alreadyAttempted.size + 1 : alreadyAttempted.size;

    return {
      attemptId: attempt.id,
      isCorrect,
      reasonCheck,
      pacing: pacingFor(timeTakenSec, question.timeLimitSec, timeNote === null),
      timeTakenSec,
      timeLimitSec: question.timeLimitSec,
      freeRemaining: subscribed ? null : freeRemaining(consumed),
      timeNote,
      answerView: toAnswerView(question, chosenLabel),
    };
  }

  /**
   * How today's practice went (T-118).
   *
   * Scoped to today and to this student's field, using the same day boundary as
   * T-110 — one notion of "a practice day" rather than two that disagree at
   * midnight.
   */
  async summary(userId: string): Promise<PracticeSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    if (!user?.fieldId) throw new NotFoundException('No programme chosen.');

    const attempts = await this.prisma.attempt.findMany({
      where: { userId, fieldId: user.fieldId, createdAt: { gte: startOfToday() } },
      select: {
        isCorrect: true,
        topicId: true,
        topic: { select: { name: true, weightPct: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return summarise(
      attempts.map((a) => ({
        topicId: a.topicId,
        topic: a.topic.name,
        weightPct: a.topic.weightPct?.toNumber() ?? null,
        isCorrect: a.isCorrect,
      })),
    );
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
