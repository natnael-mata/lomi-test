/**
 * Sets up the twelve accounts a person needs in order to test this product.
 *
 *   npm run dev:testers -w api
 *
 * The smoke-test door (`/dev-login`) mints its accounts on first use, which is
 * enough to get *in* and not enough to try anything: a brand-new account has no
 * programme, no history, no subscription and no staff role, so the paywall, the
 * receipt, the mock exam and every admin screen are unreachable. This puts ten
 * students and two operators into states that between them reach every screen.
 *
 * | Account | State | What it is for |
 * | ------- | ----- | -------------- |
 * | User A  | brand new, no programme | first run: the chooser, the first question, the free counter |
 * | User B  | 8 of 10 free used, bank claim pending | the wall two answers away, and a claim in the admin queue |
 * | User C  | paid, 12 months active | the receipt, the payment history, the mock exam, practice with no wall |
 * | User D  | all 10 free spent, never paid | the paywall on arrival — the wall before the question, not after it |
 * | User E  | subscription expired yesterday | "paid and ran out", which is a different offer from "never paid" |
 * | User F  | a mock open and unsubmitted | resuming the paper, the practice lock, the submit confirmation |
 * | User G  | a mock finished | the result, the review of a closed paper, the trend with a point on it |
 * | User H  | five days engaged, points banked | the standing and the leaderboard with something in them |
 * | User I  | answered a lot, mostly wrong | readiness low, the focus list full, and the never-shame copy under load |
 * | User J  | two live devices | the device list at its limit, and revoking one |
 * | Admin   | ADMIN staff | every `/admin` screen, including settling User B's claim |
 * | Provider | PROVIDER staff | the activity log and the live health board, above admin |
 *
 * **Re-runnable, and it produces the state it claims.** Every write is an upsert
 * or is guarded, and the states that a tester's own actions would move — spent
 * attempts, a settled claim, an open sitting — are reset rather than added to.
 * A seed that only ever adds ends up describing an account that no longer
 * matches it, which is worse than no seed at all: the tester believes the brief.
 *
 * It touches **only** accounts in the reserved smoke-test Telegram range
 * (`isDevTelegramId`), so it cannot reach a real student even if it is run
 * against a database that has some.
 */
import { PrismaClient, type PrismaClient as Client } from '@prisma/client';

import { AuditService } from '../src/audit/audit.service';
import { SubscriptionsService } from '../src/payments/subscriptions.service';
import { devTelegramId, isDevTelegramId } from '../src/auth/dev-login';
import { hashPassword } from '../src/auth/password';
import { EngagementService } from '../src/engagement/engagement.service';
import { ExamBuildService } from '../src/exams/exam-build.service';
import { ExamsService } from '../src/exams/exams.service';
import { RULES } from '../src/engagement/points';
import { TaxonomyService } from '../src/taxonomy/taxonomy.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();

/** The field the demo bank lives in. `dev:publish` owns it. */
const FIELD_SLUG = 'local-dev';

/**
 * The four personas.
 *
 * `label` is what `/dev-login` posts and what `devTelegramId` hashes, so it is
 * the account's identity and must not change casually — changing it mints a new
 * account and abandons the old one's history. `name` is what every screen shows.
 */
const PERSONAS = [
  { label: 'usera', name: 'User A' },
  { label: 'userb', name: 'User B' },
  { label: 'userc', name: 'User C' },
  { label: 'userd', name: 'User D' },
  { label: 'usere', name: 'User E' },
  { label: 'userf', name: 'User F' },
  { label: 'userg', name: 'User G' },
  { label: 'userh', name: 'User H' },
  { label: 'useri', name: 'User I' },
  { label: 'userj', name: 'User J' },
  { label: 'userk', name: 'User K' },
  { label: 'userl', name: 'User L' },
  { label: 'userm', name: 'User M' },
  { label: 'usern', name: 'User N' },
  { label: 'usero', name: 'User O' },
  { label: 'admin', name: 'Admin' },
  { label: 'provider', name: 'Provider' },
] as const;

/** How many distinct questions User B has already used of the ten free ones. */
const USER_B_USED = 8;
/** How many User C has answered. Past the free ten, which their subscription covers. */
const USER_C_ANSWERED = 12;
/** User D has spent the lot. `FREE_ATTEMPTS_PER_FIELD` is 10. */
const USER_D_USED = 10;
/** Days User H has been engaged. The streak counts days, and nothing takes it away. */
const USER_H_DAYS = 5;
/** How many User I has answered. Enough for readiness to mean something. */
const USER_I_ANSWERED = 15;

/** Grade 12 Natural, the track with twelve questions across four years. */
const GRADE_12_SLUG = 'grade-12-natural';
const GRADE_6_SLUG = 'grade-6';
const GRADE_8_SLUG = 'grade-8';
const GRADE_12_SOCIAL_SLUG = 'grade-12-social';

/**
 * The password every seeded account signs in with (T-263).
 *
 * One password for all of them, printed in the summary. These are smoke-test
 * accounts in the reserved negative telegram range — the value of a distinct
 * password each would be a tester keeping a list, and the value of a secret one
 * is nil on a local database that ships its own seed script.
 */
const TEST_PASSWORD = 'lomi-test-2026';

/**
 * A phone number per persona, in the reserved 09 range.
 *
 * `0900000001` upward: real Ethiopian mobiles begin `09` or `07` followed by a
 * carrier digit, and `0900…` is not an allocated prefix — so these are valid in
 * shape, unique, obviously fake, and cannot collide with a real handset if this
 * script is ever pointed at the wrong database.
 */
function phoneFor(label: string): string {
  /*
   * Derived from the persona's own id, never from its position.
   *
   * This used to be `index + 1`, so inserting User N and User O in the middle
   * renumbered every persona after them — and the upsert matches on telegram
   * id, so the old rows kept the numbers the new ones were being handed. The
   * whole seed failed on a unique constraint.
   *
   * The telegram id is already a stable hash of the label, so the phone
   * inherits that stability: a persona's number depends on nothing but its own
   * name, and the list can be reordered freely.
   */
  return `09${String(Math.abs(devTelegramId(label)) % 100_000_000).padStart(8, '0')}`;
}

async function upsertPersona(label: string, name: string): Promise<string> {
  const telegramId = String(devTelegramId(label));

  /*
   * The display name is set here and nowhere else.
   *
   * The product generates its own handle and takes one from nobody (T-086),
   * which is right for a person and useless for a tester: four accounts called
   * SteadyMeadow6759 and KeenMeadow2899 cannot be told apart in the admin search
   * or the payments queue, which is exactly where you need to know which of them
   * you are looking at. These accounts are not people — they are marked as
   * smoke-test by their negative Telegram id — so naming them is safe, and the
   * rule that matters (never a legal name on a shared surface) is untouched.
   */
  /*
   * A phone and a password on every persona (T-263).
   *
   * Sign-in is moving from Telegram to phone-and-password, and a test account
   * that can only be reached through the smoke-test door cannot exercise the
   * door that is replacing it. Both identities are set, because the design keeps
   * Telegram as a *linked channel* rather than replacing it — an account that
   * loses its history when a student changes SIM is the failure this avoids.
   */
  const phone = phoneFor(label);
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { telegramId },
    update: { displayName: name, deactivatedAt: null, phone, passwordHash },
    create: { telegramId, displayName: name, phone, passwordHash },
    select: { id: true, telegramId: true },
  });

  if (!isDevTelegramId(user.telegramId)) {
    // Cannot happen — the id came from `devTelegramId` — but the guard is what
    // makes "this script cannot touch a real account" a checked claim rather
    // than a comment.
    throw new Error(`Refusing to modify ${user.id}: not a smoke-test account.`);
  }
  return user.id;
}

/**
 * Gives a student a practice history, without inventing a score.
 *
 * Attempts are written directly rather than posted through the API, because the
 * point is a starting state and not a simulation. Two thirds correct, spread
 * across the topics in bank order, so the readiness screen has something with
 * shape in it rather than four identical bars.
 */
/**
 * How long the dev mock paper runs.
 *
 * One place, because User F's open sitting is stamped with it too — a fixture
 * whose paper length and whose deadline are set independently is one that can
 * disagree with itself, which is how it ends up claiming eight hours remain on
 * a forty-five minute exam.
 */
const FIXTURE_EXAM_SEC = 45 * 60;

async function seedAttempts(
  userId: string,
  fieldId: string,
  count: number,
  /**
   * Whether the answer at this position was right.
   *
   * A parameter rather than a constant because User I exists to make the
   * readiness screen say something uncomfortable, and the default — two in
   * three correct — cannot produce that. Both shapes are fixtures either way;
   * what matters is that neither is all-correct, which is the one history that
   * leaves the focus list empty and proves nothing.
   */
  isCorrectAt: (index: number) => boolean = (index) => index % 3 !== 2,
): Promise<void> {
  const engagement = new EngagementService(prisma as PrismaService);

  /*
   * The ledger is rebuilt from scratch, like the attempts below it.
   *
   * Points are what the *answers* earned, so they are part of the state this
   * function claims rather than a running total beside it. Adding to whatever
   * was there would make a persona's points depend on how many times the seed
   * had been run, which is the drift this file exists to refuse.
   *
   * Only ever a smoke-test account, and only its own rows.
   */
  await prisma.pointEntry.deleteMany({ where: { userId } });

  const questions = await prisma.question.findMany({
    where: { fieldId, status: 'PUBLISHED' },
    orderBy: { stableId: 'asc' },
    select: {
      id: true,
      topicId: true,
      timeLimitSec: true,
      options: { select: { label: true, isCorrect: true } },
    },
  });

  /*
   * The state this claims, not merely "at least" it.
   *
   * This only ever added, so an account that had answered more than `count`
   * from an earlier session kept them — and the script still printed "8 of 10
   * free questions used" over an account with ten. QA read the label, saw
   * "0 FREE LEFT" on the next question, and reported the counter as broken. The
   * counter was right; the seed was not.
   *
   * Trimmed only for smoke-test accounts, and only inside this field, which is
   * demo content this script owns.
   */
  const extra = await prisma.attempt.findMany({
    where: { userId, fieldId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, questionId: true },
  });
  const keep = new Set<string>();
  const remove: string[] = [];
  for (const attempt of [...extra].reverse()) {
    if (keep.size < count || keep.has(attempt.questionId)) keep.add(attempt.questionId);
    else remove.push(attempt.id);
  }
  if (remove.length > 0) await prisma.attempt.deleteMany({ where: { id: { in: remove } } });

  const wanted = questions.slice(0, count);

  for (const [index, question] of wanted.entries()) {
    // Every third one wrong. A history that is all correct makes the focus list
    // empty and the readiness figure 100%, which is the one state that proves
    // nothing about the screens being tested.
    const correct = isCorrectAt(index);
    const chosen = correct
      ? question.options.find((o) => o.isCorrect)
      : question.options.find((o) => !o.isCorrect);
    if (!chosen) continue;

    /*
     * The ledger is written for every wanted answer, not only the new ones.
     *
     * It was cleared above, so skipping the ones whose attempt row already
     * existed would leave a re-run with all its answers and none of its points
     * — which is the state QA found: User I showed 15 answered on `/progress`
     * and 0 points on `/standing`, and reported, correctly, that one of the two
     * screens had to be lying. Both were faithful; the fixture had written
     * attempts and no ledger at all.
     */
    await engagement.record(userId, RULES.ANSWERED);
    if (correct) await engagement.record(userId, RULES.CORRECT);

    const already = await prisma.attempt.findFirst({
      where: { userId, questionId: question.id },
      select: { id: true },
    });
    if (already) continue;

    await prisma.attempt.create({
      data: {
        userId,
        questionId: question.id,
        fieldId,
        topicId: question.topicId,
        chosenLabel: chosen.label,
        isCorrect: correct,
        // Comfortably inside the limit, so nothing reads as "over time" — the
        // pacing verdict is a real state and should be reached by being slow,
        // not by a fixture deciding it in advance.
        timeTakenSec: Math.max(15, Math.round(question.timeLimitSec * 0.4)),
      },
    });
  }

  // Active today, so the streak has a day to stand on. Idempotent per day, and
  // the personas that need a longer streak add their own earlier days after
  // this returns.
  await engagement.touch(userId);
}

/**
 * Back to owing nothing.
 *
 * Every billing persona is set up from a clean slate rather than on top of
 * whatever the last tester left, because settling a claim and letting a plan
 * lapse are both things a tester *does*, and a seed that adds to the result
 * describes an account that no longer exists. Payments before subscriptions:
 * `Payment.subscriptionId` is RESTRICT, so the other order fails on a foreign
 * key rather than on anything to do with the state.
 *
 * The audit log is never touched. It is the record of what happened, and this
 * script's convenience is not a reason to edit history.
 */
async function clearBilling(userId: string): Promise<void> {
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.subscription.deleteMany({ where: { userId } });
}

/**
 * A settled twelve-month plan, created the way a student's would be.
 *
 * Through the real service both times: the claim, the reference, the pending
 * subscription, the activation and the audit row all exist because the same
 * code that serves a student made them. Writing the rows directly would produce
 * an account that looks subscribed and has no receipt to print.
 */
async function grantTwelveMonths(
  subscriptions: SubscriptionsService,
  userId: string,
  adminId: string,
  note: string,
): Promise<void> {
  const ref = `FT${Math.floor(Math.random() * 9_000_000_000 + 1_000_000_000)}`;
  const claim = await subscriptions.submitManualPayment(userId, 'TWELVE_MONTH', ref);
  await subscriptions.confirmManualPayment(claim.paymentId, adminId, note);
}

/** A live session row, which is what the device list counts and a sitting needs. */
async function openSession(userId: string, deviceLabel: string): Promise<string> {
  const existing = await prisma.session.findFirst({
    where: { userId, revokedAt: null, deviceLabel },
    select: { id: true },
  });
  if (existing) return existing.id;
  const session = await prisma.session.create({
    data: { userId, deviceLabel },
    select: { id: true },
  });
  return session.id;
}

/** Midnight-based day offset, so "five days engaged" means five distinct days. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Beats `beaten` questions and half-beats `guessed` more (T-261).
 *
 * A **beaten** question is correct with the reason named; a **guessed** one is
 * correct with the reason wrong. Both exist here on purpose, because the
 * difference between them is the whole claim coverage makes — a persona with
 * only beaten questions cannot show that a guess does not count.
 *
 * Written directly rather than posted through the API: the reason-check ids are
 * derived per attempt, so replaying the real flow would mean issuing a check and
 * reading its options back for every question. The state is what matters here,
 * and `coverage.e2e.test.ts` is what proves the real path produces it.
 */
async function seedCoverage(
  userId: string,
  fieldId: string,
  beaten: number,
  guessed: number,
): Promise<void> {
  const questions = await prisma.question.findMany({
    where: { fieldId, status: 'PUBLISHED' },
    orderBy: { stableId: 'asc' },
    select: { id: true, topicId: true },
  });

  // Reset first, so re-running restores the state the brief describes rather
  // than adding to whatever the last tester left. Same discipline as
  // `seedAttempts` — a seed that only ever adds ends up describing an account
  // that no longer exists.
  await prisma.attempt.deleteMany({ where: { userId, fieldId } });

  for (const [index, question] of questions.slice(0, beaten + guessed).entries()) {
    const isBeaten = index < beaten;
    await prisma.attempt.create({
      data: {
        userId,
        questionId: question.id,
        fieldId,
        topicId: question.topicId,
        chosenLabel: 'A',
        isCorrect: true,
        reasonCorrect: isBeaten,
        reasonChoiceId: isBeaten ? 'seeded-right' : 'seeded-wrong',
        timeTakenSec: 25,
      },
    });
  }
}

async function main(): Promise<void> {
  const field = await prisma.field.findUnique({
    where: { slug: FIELD_SLUG },
    select: { id: true },
  });
  if (!field) {
    console.error(`No "${FIELD_SLUG}" field. Run:  npm run dev:publish -w api`);
    process.exitCode = 1;
    return;
  }

  const ids = new Map<string, string>();
  for (const persona of PERSONAS) {
    ids.set(persona.label, await upsertPersona(persona.label, persona.name));
  }

  const audit = new AuditService(prisma as PrismaService);
  const subscriptions = new SubscriptionsService(prisma as PrismaService, audit);

  // ---- Admin: staff, so /admin/* opens ------------------------------------
  const adminId = ids.get('admin')!;
  await prisma.staffMember.upsert({
    where: { userId: adminId },
    update: { role: 'ADMIN' },
    create: { userId: adminId, role: 'ADMIN', grantedBy: 'dev-testers script' },
  });

  // ---- Provider: above admin, and the only role that sees the activity log --
  const providerId = ids.get('provider')!;
  await prisma.staffMember.upsert({
    where: { userId: providerId },
    update: { role: 'PROVIDER' },
    create: { userId: providerId, role: 'PROVIDER', grantedBy: 'dev-testers script' },
  });

  // ---- User A: nothing at all ---------------------------------------------
  // Deliberately left with no field: the programme chooser is a screen, and the
  // only way to see it is to be somebody who has not chosen.
  const userA = ids.get('usera')!;
  /*
   * Brand new means brand new, including the history.
   *
   * This cleared the programme and nothing else, so a tester who practised as
   * User A last week left attempts behind — and the next tester chose a
   * programme and met "9 free left" on a question they had never seen. They
   * reported an off-by-one in the counter. The counter was right: the account
   * was not new, and only the brief said it was.
   */
  await prisma.attempt.deleteMany({ where: { userId: userA } });
  await prisma.pointEntry.deleteMany({ where: { userId: userA } });
  await clearBilling(userA);
  await prisma.user.update({ where: { id: userA }, data: { fieldId: null } });

  // ---- User B: two free questions left, one claim waiting ------------------
  const userB = ids.get('userb')!;
  await prisma.user.update({ where: { id: userB }, data: { fieldId: field.id } });
  await seedAttempts(userB, field.id, USER_B_USED);

  /*
   * Back to *unpaid*, because a tester's first move is to approve the claim.
   *
   * User B exists to show the free wall and the admin queue, and settling that
   * claim is the thing the brief asks an admin to do — which leaves the account
   * subscribed. Re-running this script then printed "bank claim waiting to be
   * checked" over a twelve-month subscriber with no wall left to hit, and the
   * next tester found a screen that matched nothing in their brief.
   *
   * Dropped rather than reused: settling is what the tester is here to do, and
   * a half-cleared subscription is a worse starting state than none. Scoped to
   * this one smoke-test account, whose id `upsertPersona` has already checked
   * is in the reserved range. The audit rows stay — they are a record of what
   * happened, and this is the one table nothing here may delete from.
   */
  await clearBilling(userB);

  const bClaim = await prisma.payment.findFirst({
    where: { userId: userB, method: 'BANK', status: 'PENDING' },
    select: { txRef: true },
  });
  let bRef = bClaim?.txRef ?? null;
  if (!bRef) {
    // Through the real service, so the pending subscription, the unique
    // reference and the audit row are all created the way a student's claim
    // would create them.
    const ref = `FT${Date.now().toString().slice(-10)}`;
    await subscriptions.submitManualPayment(userB, 'TWELVE_MONTH', ref);
    bRef = ref;
  }

  // ---- User C: paid, twelve months --------------------------------------
  const userC = ids.get('userc')!;
  await prisma.user.update({ where: { id: userC }, data: { fieldId: field.id } });
  await seedAttempts(userC, field.id, USER_C_ANSWERED);

  const live = await prisma.subscription.findFirst({
    where: { userId: userC, status: 'ACTIVE' },
    select: { id: true },
  });
  // Settled by the admin persona, so the audit row names a real actor and the
  // receipt has a settledAt to print.
  if (!live) await grantTwelveMonths(subscriptions, userC, adminId, 'Set up by dev:testers.');

  // ---- User D: the free tier spent, and never paid -------------------------
  // The account that meets the wall on arrival rather than two answers in. It is
  // the state T-239 changed: the server now refuses to *serve* a question it
  // would refuse to accept, so this persona should land on the paywall without
  // ever being shown a stem it cannot answer.
  const userD = ids.get('userd')!;
  await prisma.user.update({ where: { id: userD }, data: { fieldId: field.id } });
  await clearBilling(userD);
  /*
   * Every one right, and today — which is what actually produces the wall.
   *
   * Ten spent attempts alone do not: an already-seen question stays answerable
   * because re-practice costs nothing, so the server rightly offered one of
   * those instead of refusing. T-110 excludes anything got right *today*, so a
   * clean sweep leaves nothing offerable and the wall arrives on arrival —
   * which is the state this persona exists to show.
   *
   * Worth knowing while testing: tomorrow those ten become answerable again and
   * User D goes back to re-practice. Re-run this script to restore the wall.
   */
  await seedAttempts(userD, field.id, USER_D_USED, () => true);

  // ---- User E: paid, and ran out -------------------------------------------
  /*
   * A separate state from "never paid", deliberately.
   *
   * The schema keeps EXPIRED apart from PENDING for exactly this reason: the two
   * need different words and a different offer. Somebody who paid and lapsed is
   * being asked to renew; somebody who never paid is being asked to start. This
   * is the account that proves the product tells them apart.
   *
   * Granted through the real service and then aged, rather than written expired:
   * the receipt, the payment row and the audit trail all have to exist, because
   * "I paid you in March" is the support question this state generates.
   */
  const userE = ids.get('usere')!;
  await prisma.user.update({ where: { id: userE }, data: { fieldId: field.id } });
  await clearBilling(userE);
  await seedAttempts(userE, field.id, USER_C_ANSWERED);
  await grantTwelveMonths(subscriptions, userE, adminId, 'Set up by dev:testers, then aged.');
  /*
   * Aged at both ends, because the database will not accept it otherwise.
   *
   * `Subscription_expires_after_activation` refused the first version of this —
   * expiring yesterday a plan that activated today is not a state a real
   * account can be in, and the constraint said so. A twelve-month plan that
   * lapsed yesterday started a year and a day ago, so that is what this writes.
   */
  await prisma.subscription.updateMany({
    where: { userId: userE, status: 'ACTIVE' },
    data: { status: 'EXPIRED', activatedAt: daysAgo(366), expiresAt: daysAgo(1) },
  });

  // ---- A paper to sit ------------------------------------------------------
  const exam = await prisma.exam.findFirst({ where: { fieldId: field.id, isActive: true } });
  let examNote = 'already built';
  if (!exam) {
    const builder = new ExamBuildService(
      prisma as PrismaService,
      new TaxonomyService(prisma as PrismaService),
      audit,
    );
    try {
      /*
       * Twenty questions, not a hundred.
       *
       * The real paper is 100 in 3 hours and the demo bank holds 20, so a
       * full-size blueprint would fail to sample and leave `/exam` unreachable.
       * A short paper exercises the same screens — timer, navigator, flagging,
       * submission, review — which is what a local test is for. The blueprint is
       * an argument precisely so this is a caller's decision rather than a
       * constant somebody edits and forgets.
       */
      const built = await builder.build(
        {
          fieldId: field.id,
          slug: 'local-dev-mock',
          name: 'Local Dev mock (short)',
          // 12 + 8 is the whole demo bank, which is what it holds: 12 concept
          // and 8 calculation. Asking for one more calculation than exists is
          // how the first version of this failed, with a 422 that named the
          // shortfall nobody was reading.
          blueprint: { conceptCount: 12, calculationCount: 8, durationSec: FIXTURE_EXAM_SEC },
        },
        adminId,
      );
      examNote = `built "${built.name}" — ${built.conceptCount + built.calculationCount} questions`;
    } catch (error) {
      // The builder reports every shortfall at once, in `response.blockers`.
      // The bare message is "Unprocessable Entity Exception", which says
      // nothing anybody can act on.
      const blockers = (error as { response?: { blockers?: string[] } })?.response?.blockers;
      examNote = `NOT built — ${blockers?.join('; ') ?? (error instanceof Error ? error.message : String(error))}`;
    }
  }

  /*
   * The four personas that need something built before they can exist.
   *
   * F and G need a paper, so they come after it. H needs days rather than rows.
   * J needs sessions, which is the one state a tester cannot create twice from
   * one browser — which is exactly why it has to be seeded.
   */
  const engagement = new EngagementService(prisma as PrismaService);
  const exams = new ExamsService(prisma as PrismaService, engagement, subscriptions);

  // ---- User F: a paper open, mid-sitting -----------------------------------
  /*
   * The state a student is in when their phone dies.
   *
   * Worth its own account because it locks a screen the tester would otherwise
   * never see refused: with a sitting open, `/practice` says "Finish or submit
   * your exam before practising" instead of serving a question. And it is the
   * only way to reach the submit confirmation without answering twenty
   * questions first — the panel only appears when something is blank.
   */
  const userF = ids.get('userf')!;
  await prisma.user.update({ where: { id: userF }, data: { fieldId: field.id } });
  await clearBilling(userF);
  await grantTwelveMonths(subscriptions, userF, adminId, 'Set up by dev:testers.');
  let fNote = 'no paper to sit';
  if (exam) {
    const sessionF = await openSession(userF, 'Chrome on Android');
    const started = await exams.start(userF, sessionF);
    // Three answered out of twenty, so the navigator has a mix and the
    // confirmation has a real number to report.
    for (let position = 1; position <= 3; position++) {
      await exams.answer(userF, started.sittingId, position, { chosenLabel: 'A' }, sessionF);
    }

    /*
     * The clock is restarted, and it is a real one.
     *
     * A first pass held this open for eight hours so the resume path would
     * survive a testing session. That produced a paper reading "8:00:00 left"
     * beside "45 minutes" — a fixture lying in a new direction to cover for the
     * old lie, and a bug report waiting to be filed.
     *
     * The honest version: a genuine 45-minute window, restarted from this run,
     * plus a product that says what happened when the window closes. `start`
     * now reports `settledPrevious: 'EXPIRED'` and the screen explains that the
     * old paper was marked rather than lost — which was the real defect QA
     * found. A tester arriving late gets a correct, self-explaining screen
     * instead of a silent restart, and re-running this script puts the open
     * paper back.
     */
    const now = new Date();
    await prisma.sitting.update({
      where: { id: started.sittingId },
      data: { startedAt: now, endsAt: new Date(now.getTime() + FIXTURE_EXAM_SEC * 1000) },
    });
    fNote = `sitting open, 3 of 20 answered — open for ${FIXTURE_EXAM_SEC / 60} more minutes`;
  }

  // ---- User G: a paper finished --------------------------------------------
  // The only account with a closed sitting, which is the only way to reach the
  // result screen, the review of a graded paper, and a trend with a point on it.
  const userG = ids.get('userg')!;
  await prisma.user.update({ where: { id: userG }, data: { fieldId: field.id } });
  await clearBilling(userG);
  await grantTwelveMonths(subscriptions, userG, adminId, 'Set up by dev:testers.');
  let gNote = 'no paper to sit';
  if (exam) {
    const open = await prisma.sitting.findFirst({
      where: { userId: userG, closedAt: null },
      select: { id: true },
    });
    if (open) {
      gNote = 'paper already sat';
    } else {
      const done = await prisma.sitting.findFirst({ where: { userId: userG } });
      if (done) {
        gNote = 'paper already sat';
      } else {
        const sessionG = await openSession(userG, 'Firefox on Windows');
        const started = await exams.start(userG, sessionG);
        for (let position = 1; position <= 20; position++) {
          // B every time: some right, some wrong, and none of it a claim about
          // how a real student answers.
          await exams.answer(userG, started.sittingId, position, { chosenLabel: 'B' }, sessionG);
        }
        const result = await exams.submit(userG, started.sittingId);
        gNote = `sat and submitted — scored ${result.scoreCorrect} of ${result.totalQuestions}`;
      }
    }
  }

  /*
   * However G's paper got there, it took a believable amount of time.
   *
   * Outside the branch above on purpose. Twenty questions answered by a script
   * take about a sixth of a second, so the trend reported "0 min used" beside a
   * completed twenty-question paper — and because the branch only runs when
   * there is no paper yet, re-seeding could never repair one already written.
   * That is the "only ever adds" failure this file is supposed to be free of:
   * the state described in the summary has to be the state on the account, not
   * the state the first run happened to leave.
   *
   * Thirty-one minutes of a forty-five minute paper is a student who finished
   * with time in hand.
   */
  const G_USED_MIN = 31;
  const gPaper = await prisma.sitting.findFirst({
    where: { userId: userG, closedAt: { not: null } },
    orderBy: { startedAt: 'desc' },
    select: { id: true, closedAt: true },
  });
  if (gPaper?.closedAt) {
    const opened = new Date(gPaper.closedAt.getTime() - G_USED_MIN * 60_000);
    await prisma.sitting.update({
      where: { id: gPaper.id },
      data: { startedAt: opened, endsAt: new Date(opened.getTime() + FIXTURE_EXAM_SEC * 1000) },
    });
    gNote = `${gNote} · took ${G_USED_MIN} min`;
  }

  // ---- User H: five days engaged -------------------------------------------
  /*
   * The streak counts **days engaged, and nothing takes it away** — so this is
   * seeded as five days rather than five rows, through the same `touch` the
   * product calls. A streak written as a number would be a number this script
   * made up; this one is derived from the ledger the screen reads.
   */
  const userH = ids.get('userh')!;
  await prisma.user.update({ where: { id: userH }, data: { fieldId: field.id } });
  await seedAttempts(userH, field.id, USER_C_ANSWERED);
  for (let back = USER_H_DAYS - 1; back >= 0; back--) {
    const day = daysAgo(back);
    await engagement.touch(userH, day);
    const already = await prisma.pointEntry.findFirst({
      where: { userId: userH, ruleId: RULES.ANSWERED.id, day: day.toISOString().slice(0, 10) },
      select: { id: true },
    });
    if (!already) await engagement.record(userH, RULES.ANSWERED, day);
  }

  // ---- User I: answered a lot, and struggling ------------------------------
  /*
   * The account that makes the progress screens say something uncomfortable.
   *
   * Every other persona is doing fine, which means the never-shame rule has
   * never actually been under load — a readiness figure of 78% and a focus list
   * of one topic tests nothing. One in four correct puts a real number on that
   * screen and asks whether the product can deliver it without making somebody
   * feel worse for having practised.
   */
  const userI = ids.get('useri')!;
  await prisma.user.update({ where: { id: userI }, data: { fieldId: field.id } });
  await clearBilling(userI);
  await grantTwelveMonths(subscriptions, userI, adminId, 'Set up by dev:testers.');
  await seedAttempts(userI, field.id, USER_I_ANSWERED, (index) => index % 4 === 0);

  // ---- User J: at the two-device limit -------------------------------------
  // A tester cannot make this state from one browser, so it is seeded: two live
  // sessions, which is the limit (T-082). Signing in as User J evicts the older
  // one, which is the behaviour worth watching.
  const userJ = ids.get('userj')!;
  await prisma.user.update({ where: { id: userJ }, data: { fieldId: field.id } });
  await seedAttempts(userJ, field.id, 3);
  await openSession(userJ, 'Chrome on Android');
  await openSession(userJ, 'Safari on iPhone');

  /*
   * The school tracks (T-261).
   *
   * Everything above is on the exit-exam demo bank, which has no `sourceGrade`
   * and therefore no per-year diagnostic and no junior band. These three make
   * the restructure reachable: a Grade 12 student with a real coverage figure,
   * and the two halves of the junior default.
   */
  const g12 = await prisma.field.findUnique({ where: { slug: GRADE_12_SLUG } });
  const g6 = await prisma.field.findUnique({ where: { slug: GRADE_6_SLUG } });
  let schoolNote = 'not seeded — run: npm run dev:publish:school -w api';

  if (g12 && g6) {
    // User K: five of twelve beaten and two more guessed. The guessed pair is
    // the point — coverage must read 5, not 7.
    const userK = ids.get('userk')!;
    await prisma.user.update({ where: { id: userK }, data: { fieldId: g12.id } });
    await seedCoverage(userK, g12.id, 5, 2);

    // User L: a junior who asked to be on the board.
    const userL = ids.get('userl')!;
    await prisma.user.update({
      where: { id: userL },
      data: { fieldId: g6.id, leaderboardOptOut: false },
    });
    await seedCoverage(userL, g6.id, 4, 0);

    // User M: a junior nobody has asked. Must appear on no board at all, and
    // must still be able to see their own rank.
    const userM = ids.get('userm')!;
    await prisma.user.update({
      where: { id: userM },
      data: { fieldId: g6.id, leaderboardOptOut: null },
    });
    await seedCoverage(userM, g6.id, 6, 0);

    /*
     * Two more tracks, so the ten students span every programme the product
     * offers rather than three of them.
     *
     * A Grade 8 and a Grade 12 Social student are the two cases nothing else
     * covers: Grade 8 is the *other* junior band member, and Social is the half
     * of Grade 12 that must never appear in a Natural candidate's denominator.
     * Without them the band rule and the two-Fields decision are both untested
     * by hand.
     */
    const g8 = await prisma.field.findUnique({ where: { slug: GRADE_8_SLUG } });
    const g12s = await prisma.field.findUnique({ where: { slug: GRADE_12_SOCIAL_SLUG } });

    if (g8) {
      const userN = ids.get('usern');
      if (userN) {
        await prisma.user.update({
          where: { id: userN },
          data: { fieldId: g8.id, leaderboardOptOut: false },
        });
        await seedCoverage(userN, g8.id, 2, 1);
      }
    }
    if (g12s) {
      const userO = ids.get('usero');
      if (userO) {
        await prisma.user.update({ where: { id: userO }, data: { fieldId: g12s.id } });
        await seedCoverage(userO, g12s.id, 3, 0);
      }
    }

    schoolNote = 'seeded';
  }

  const line = (label: string, value: string): string => `  ${label.padEnd(9)} ${value}`;
  console.log('\nTest accounts ready. Sign in at http://localhost:3100/dev-login\n');
  console.log('  Type the name exactly as shown — the door normalises spacing and case.');
  console.log(
    `  Or sign in with a phone number and the password "${TEST_PASSWORD}" ` +
      "— each persona's number is printed beside it below.\n",
  );
  console.log(line('User A', 'no programme chosen — starts at the programme chooser'));
  console.log(
    line(
      'User B',
      `${USER_B_USED} of 10 free questions used · bank claim ${bRef} waiting to be checked`,
    ),
  );
  console.log(
    line('User C', `${USER_C_ANSWERED} questions answered · 12-month access, receipt and history`),
  );
  console.log(
    line('User D', `all ${USER_D_USED} free spent and right today — the paywall on arrival`),
  );
  console.log(line('User E', 'paid and lapsed — expired yesterday, so the offer is renewal'));
  console.log(line('User F', `subscribed · ${fNote}`));
  console.log(line('User G', `subscribed · ${gNote}`));
  console.log(line('User H', `${USER_H_DAYS}-day streak with points banked`));
  console.log(
    line('User I', `subscribed · ${USER_I_ANSWERED} answered, 1 in 4 right — readiness under load`),
  );
  console.log(line('User J', 'two live devices — at the limit; a third sign-in evicts one'));
  console.log(
    line(
      'User K',
      `Grade 12 Natural · 5 of 12 beaten, 2 guessed — coverage reads 5 (${schoolNote})`,
    ),
  );
  console.log(line('User L', 'Grade 6 junior, opted IN to the board — 4 of 6 beaten'));
  console.log(line('User M', 'Grade 6 junior, never asked — on no board, still sees their rank'));
  console.log(line('User N', 'Grade 8 junior, opted IN — the other junior track'));
  console.log(line('User O', 'Grade 12 Social — never measured on Natural questions'));
  console.log(line('Admin', 'ADMIN staff — dashboard, payments, import, weights, students'));
  console.log(line('Provider', 'PROVIDER staff — the activity log and the live health board'));
  console.log(`\n  Mock paper: ${examNote}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => (prisma as Client).$disconnect());
