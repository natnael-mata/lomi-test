/**
 * Integration test — a phone number is only stored when Telegram vouches for it
 * (T-078a).
 *
 * The task names two cases and both are here: a shared contact whose `user_id`
 * is not the sender is rejected, and a matching one sets `phone` and
 * `phoneVerifiedAt`.
 *
 * **The rejection is asserted against the database, not against the response.**
 * A route that answers `{ stored: false }` and writes the row anyway would pass
 * an assertion about its own reply, and the column would still say verified.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

const BOT_SECRET = 'bot-secret-for-the-contact-e2e-000';
const SFX = 'e2e-contact';

/** The student sharing their own number, and the person they might share instead. */
const TG = { student: '564100001', someoneElse: '564100002' };

describe('a verified phone (T-078a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let previousSecret: string | undefined;

  const cleanup = async (): Promise<void> => {
    // `BotProfile` holds a scalar `userId` rather than a Prisma relation, like
    // most of this schema — so the ids are looked up first rather than filtered
    // through a join that does not exist.
    const ours = await prisma.user.findMany({
      where: { telegramId: { startsWith: '5641000' } },
      select: { id: true },
    });
    const ids = ours.map((u) => u.id);
    await prisma.botProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  const post = (body: { telegramId: string; contactUserId: string; phone: string }) =>
    request(app.getHttpServer()).post('/bot/contact').set('x-bot-secret', BOT_SECRET).send(body);

  const student = async () =>
    prisma.user.findUniqueOrThrow({
      where: { telegramId: TG.student },
      select: { phone: true, phoneVerifiedAt: true },
    });

  beforeAll(async () => {
    previousSecret = process.env.BOT_SHARED_SECRET;
    process.env.BOT_SHARED_SECRET = BOT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
    await prisma.user.create({
      data: { telegramId: TG.student, displayName: `Student ${SFX}` },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    if (previousSecret === undefined) delete process.env.BOT_SHARED_SECRET;
    else process.env.BOT_SHARED_SECRET = previousSecret;
  });

  it('stores a number the sender shared about themselves', async () => {
    const res = await post({
      telegramId: TG.student,
      contactUserId: TG.student,
      phone: '+251911223344',
    }).expect(201);

    expect(res.body.stored).toBe(true);

    const after = await student();
    // Normalised through the same function the payment path uses: the same
    // handset typed two ways must not be able to hold two accounts.
    expect(after.phone).toBe('0911223344');
    expect(after.phoneVerifiedAt).not.toBeNull();
  });

  /**
   * The case the feature exists for.
   *
   * Telegram sends the same message type whether somebody taps the button or
   * picks a name out of their address book; `user_id` is the only difference.
   */
  it('refuses a contact shared about somebody else, and writes nothing', async () => {
    const res = await post({
      telegramId: TG.student,
      contactUserId: TG.someoneElse,
      phone: '+251911999999',
    }).expect(201);

    expect(res.body).toEqual({ stored: false, reason: 'not-own-contact' });

    // Asserted against the row, not the reply. A route that answers "no" and
    // writes anyway would pass an assertion about its own answer.
    const after = await student();
    expect(after.phone).toBeNull();
    expect(after.phoneVerifiedAt).toBeNull();
  });

  it('refuses a number that is not an Ethiopian mobile', async () => {
    const res = await post({
      telegramId: TG.student,
      contactUserId: TG.student,
      phone: '+44 7700 900000',
    }).expect(201);

    expect(res.body).toEqual({ stored: false, reason: 'bad-number' });
    expect((await student()).phone).toBeNull();
  });

  /**
   * `User.phone` is unique. Two accounts on one handset is a conversation —
   * somebody who lost an account, or two people sharing a subscription — and
   * not something a bot settles by overwriting a row.
   */
  it('refuses a number another account already holds', async () => {
    await prisma.user.create({
      data: {
        telegramId: TG.someoneElse,
        displayName: `Other ${SFX}`,
        phone: '0911223344',
        phoneVerifiedAt: new Date(),
      },
    });

    const res = await post({
      telegramId: TG.student,
      contactUserId: TG.student,
      phone: '0911223344',
    }).expect(201);

    expect(res.body).toEqual({ stored: false, reason: 'taken' });
    expect((await student()).phone).toBeNull();
  });

  it('is reachable only by the bot', async () => {
    // 401, not 403: `BotGuard` gives one answer to every failure past its first
    // line — missing header, wrong length, wrong value — because a caller
    // learning which of those it was is a caller being helped.
    await request(app.getHttpServer())
      .post('/bot/contact')
      .send({ telegramId: TG.student, contactUserId: TG.student, phone: '0911223344' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/bot/contact')
      .set('x-bot-secret', `${BOT_SECRET}-wrong`)
      .send({ telegramId: TG.student, contactUserId: TG.student, phone: '0911223344' })
      .expect(401);

    expect((await student()).phone).toBeNull();
  });
});
