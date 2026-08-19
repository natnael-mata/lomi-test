/**
 * Sets up the four accounts a person needs in order to test this product.
 *
 *   npm run dev:testers -w api
 *
 * The smoke-test door (`/dev-login`) mints its accounts on first use, which is
 * enough to get *in* and not enough to try anything: a brand-new account has no
 * programme, no history, no subscription and no staff role, so the paywall, the
 * receipt, the mock exam and every admin screen are unreachable. This puts the
 * four personas into four states that between them cover the product.
 *
 * | Account | State | What it is for |
 * | ------- | ----- | -------------- |
 * | User A  | brand new, no programme | first run: choosing a programme, the first question, the free counter |
 * | User B  | 8 questions used, one bank claim pending | the free wall two answers away, and a claim sitting in the admin queue |
 * | User C  | paid, 12 months active | the receipt, the payment history, the mock exam, practice with no wall |
 * | Admin   | ADMIN staff | every `/admin` screen, including settling User B's claim |
 * | Provider | PROVIDER staff | the activity log and the live health board, above admin |
 *
 * **Re-runnable.** Every write is an upsert or is guarded, so running it twice
 * leaves the same four accounts in the same four states rather than a second set
 * of them. Run it again after `db:dev` recreates the database.
 *
 * It touches **only** accounts in the reserved smoke-test Telegram range
 * (`isDevTelegramId`), so it cannot reach a real student even if it is run
 * against a database that has some.
 */
import { PrismaClient, type PrismaClient as Client } from '@prisma/client';

import { AuditService } from '../src/audit/audit.service';
import { SubscriptionsService } from '../src/payments/subscriptions.service';
import { devTelegramId, isDevTelegramId } from '../src/auth/dev-login';
import { ExamBuildService } from '../src/exams/exam-build.service';
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
  { label: 'admin', name: 'Admin' },
  { label: 'provider', name: 'Provider' },
] as const;

/** How many distinct questions User B has already used of the ten free ones. */
const USER_B_USED = 8;
/** How many User C has answered. Past the free ten, which their subscription covers. */
const USER_C_ANSWERED = 12;

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
  const user = await prisma.user.upsert({
    where: { telegramId },
    update: { displayName: name, deactivatedAt: null },
    create: { telegramId, displayName: name },
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
async function seedAttempts(userId: string, fieldId: string, count: number): Promise<void> {
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
    const already = await prisma.attempt.findFirst({
      where: { userId, questionId: question.id },
      select: { id: true },
    });
    if (already) continue;

    // Every third one wrong. A history that is all correct makes the focus list
    // empty and the readiness figure 100%, which is the one state that proves
    // nothing about the screens being tested.
    const correct = index % 3 !== 2;
    const chosen = correct
      ? question.options.find((o) => o.isCorrect)
      : question.options.find((o) => !o.isCorrect);
    if (!chosen) continue;

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
  // Payments first: `Payment.subscriptionId` is RESTRICT, so the other order
  // fails on the foreign key rather than on anything to do with the state.
  await prisma.payment.deleteMany({ where: { userId: userB } });
  await prisma.subscription.deleteMany({ where: { userId: userB } });

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
  if (!live) {
    const ref = `FT${(Date.now() + 1).toString().slice(-10)}`;
    const claim = await subscriptions.submitManualPayment(userC, 'TWELVE_MONTH', ref);
    // Settled by the admin persona, so the audit row names a real actor and the
    // receipt has a settledAt to print.
    await subscriptions.confirmManualPayment(claim.paymentId, adminId, 'Set up by dev:testers.');
  }

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
          blueprint: { conceptCount: 12, calculationCount: 8, durationSec: 45 * 60 },
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

  const line = (label: string, value: string): string => `  ${label.padEnd(9)} ${value}`;
  console.log('\nTest accounts ready. Sign in at http://localhost:3100/dev-login\n');
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
