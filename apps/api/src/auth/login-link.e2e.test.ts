/**
 * Integration test — Telegram deep-link sign-in (T-075–T-078).
 *
 * The state machine is proved in `login-link.test.ts` without a database. What
 * is checked here is the half that only a live app can show: that a nonce alone
 * is worth nothing, that the bot routes are unreachable without the shared
 * secret, and that the session which comes out is an ordinary revocable one.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

const TG = 566000007;
const BOT_SECRET = 'test-bot-secret-e2e-login-link';
const BOT_USERNAME = 'LomiTestE2EBot';

describe('signing in through the Telegram bot (T-075–T-078)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const previous: Record<string, string | undefined> = {};

  const bot = { 'x-bot-secret': BOT_SECRET };

  /** A fresh login request, as the browser gets it. */
  const create = async (): Promise<{
    nonce: string;
    pollSecret: string;
    deepLink: string;
    pairingCode: string;
  }> =>
    (
      await request(app.getHttpServer())
        .post('/auth/login-link')
        .send({ deviceLabel: 'Firefox on Linux' })
        .expect(201)
    ).body;

  const approve = (nonce: string, telegramId = String(TG)) =>
    request(app.getHttpServer())
      .post(`/auth/login-link/${nonce}/approve`)
      .set(bot)
      .send({ telegramId, telegramUsername: 'student' });

  const claim = (nonce: string, pollSecret: string) =>
    request(app.getHttpServer()).post('/auth/login-link/claim').send({ nonce, pollSecret });

  beforeAll(async () => {
    for (const key of ['BOT_SHARED_SECRET', 'TELEGRAM_BOT_USERNAME', 'JWT_SECRET']) {
      previous[key] = process.env[key];
    }
    process.env.BOT_SHARED_SECRET = BOT_SECRET;
    process.env.TELEGRAM_BOT_USERNAME = BOT_USERNAME;
    process.env.JWT_SECRET = 'test-secret-not-a-real-one';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();
  });

  afterEach(async () => {
    await prisma.loginRequest.deleteMany({});
  });

  afterAll(async () => {
    await wipe();
    await app.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const wipe = async (): Promise<void> => {
    await prisma.loginRequest.deleteMany({});
    await prisma.session.deleteMany({ where: { user: { telegramId: String(TG) } } });
    await prisma.attempt.deleteMany({ where: { user: { telegramId: String(TG) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
  };

  describe('minting a link (T-075)', () => {
    it('returns a deep link carrying the nonce', async () => {
      const body = await create();
      expect(body.deepLink).toBe(`https://t.me/${BOT_USERNAME}?start=login_${body.nonce}`);
      expect(body.pairingCode).toMatch(/^\d{3}$/);
    });

    /**
     * T-075's stated test, and the property the whole flow rests on.
     *
     * The secret is what proves this browser is the one that asked. The moment
     * it travels in the link, anyone the link is forwarded to can finish the
     * sign-in — so it must be absent from the URL, not merely hard to spot.
     */
    it('keeps the pollSecret out of the link', async () => {
      const body = await create();
      expect(body.pollSecret.length).toBeGreaterThanOrEqual(32);
      expect(body.deepLink).not.toContain(body.pollSecret);
    });

    /** And out of the database in plaintext, for when the database leaks. */
    it('stores only a hash of the secret', async () => {
      const body = await create();
      const row = await prisma.loginRequest.findUniqueOrThrow({ where: { nonce: body.nonce } });
      expect(row.pollSecretHash).not.toBe(body.pollSecret);
      expect(row.pollSecretHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('mints a different nonce and secret every time', async () => {
      const [a, b] = [await create(), await create()];
      expect(a.nonce).not.toBe(b.nonce);
      expect(a.pollSecret).not.toBe(b.pollSecret);
    });
  });

  describe('the bot routes are the bot’s alone (T-076)', () => {
    it('refuses approve without the shared secret', async () => {
      const { nonce } = await create();
      await request(app.getHttpServer())
        .post(`/auth/login-link/${nonce}/approve`)
        .send({ telegramId: String(TG) })
        .expect(401);
    });

    it('refuses approve with the wrong secret', async () => {
      const { nonce } = await create();
      await request(app.getHttpServer())
        .post(`/auth/login-link/${nonce}/approve`)
        .set({ 'x-bot-secret': 'not-it' })
        .send({ telegramId: String(TG) })
        .expect(401);
    });

    it('refuses the prompt and decline routes too', async () => {
      const { nonce } = await create();
      await request(app.getHttpServer()).get(`/auth/login-link/${nonce}/prompt`).expect(401);
      await request(app.getHttpServer()).post(`/auth/login-link/${nonce}/decline`).expect(401);
    });

    /**
     * A guard that opens when its configuration is missing is worse than none:
     * it looks like protection in the route table while being a bypass in
     * whichever environment forgot the variable.
     */
    it('refuses everything when the secret is not configured at all', async () => {
      const { nonce } = await create();
      const saved = process.env.BOT_SHARED_SECRET;
      delete process.env.BOT_SHARED_SECRET;
      try {
        await request(app.getHttpServer())
          .post(`/auth/login-link/${nonce}/approve`)
          .set(bot)
          .send({ telegramId: String(TG) })
          .expect(401);
      } finally {
        process.env.BOT_SHARED_SECRET = saved;
      }
    });

    it('gives the bot what it needs for the prompt', async () => {
      const { nonce, pairingCode } = await create();
      const body = (
        await request(app.getHttpServer())
          .get(`/auth/login-link/${nonce}/prompt`)
          .set(bot)
          .expect(200)
      ).body;
      expect(body.pairingCode).toBe(pairingCode);
      expect(body.deviceLabel).toBe('Firefox on Linux');
    });
  });

  describe('claiming a session (T-077)', () => {
    it('says pending before the student has confirmed', async () => {
      const { nonce, pollSecret } = await create();
      const res = await claim(nonce, pollSecret).expect(201);
      expect(res.body).toEqual({ pending: true });
      expect(res.body.token).toBeUndefined();
    });

    it('issues a session once approved', async () => {
      const { nonce, pollSecret } = await create();
      await approve(nonce).expect(201);

      const res = await claim(nonce, pollSecret).expect(201);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.isNew).toBe(true);

      // An ordinary session: it authenticates, and it is in the devices list, so
      // T-084 can revoke it like any other.
      const me = await request(app.getHttpServer())
        .get('/me/devices')
        .set({ Authorization: `Bearer ${res.body.token}` })
        .expect(200);
      expect(me.body.length).toBeGreaterThanOrEqual(1);
    });

    /**
     * The one that matters most.
     *
     * Knowing the nonce is knowing what was in the link. If that were enough to
     * collect the session, forwarding the link would be account takeover.
     */
    it('refuses a claim with the wrong secret, even when approved', async () => {
      const { nonce } = await create();
      await approve(nonce).expect(201);
      await claim(nonce, 'f'.repeat(64)).expect(401);

      // And the request is still there to be claimed properly — a failed guess
      // must not consume somebody else's login.
      const row = await prisma.loginRequest.findUniqueOrThrow({ where: { nonce } });
      expect(row.claimedAt).toBeNull();
    });

    it('refuses a claim for a nonce that never existed', async () => {
      await claim('nope', 'f'.repeat(64)).expect(401);
    });

    it('signs the same person back into the same account', async () => {
      const first = await create();
      await approve(first.nonce).expect(201);
      const a = await claim(first.nonce, first.pollSecret).expect(201);

      const second = await create();
      await approve(second.nonce).expect(201);
      const b = await claim(second.nonce, second.pollSecret).expect(201);

      expect(b.body.userId).toBe(a.body.userId);
      expect(b.body.isNew).toBe(false);
    });
  });

  describe('single use and expiry (T-078)', () => {
    /** T-078's stated test. */
    it('refuses a second claim', async () => {
      const { nonce, pollSecret } = await create();
      await approve(nonce).expect(201);
      await claim(nonce, pollSecret).expect(201);
      await claim(nonce, pollSecret).expect(401);
    });

    it('refuses a claim after the two minutes are up', async () => {
      const { nonce, pollSecret } = await create();
      await approve(nonce).expect(201);
      await prisma.loginRequest.update({
        where: { nonce },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await claim(nonce, pollSecret).expect(401);
    });

    it('refuses to approve an expired request', async () => {
      const { nonce } = await create();
      await prisma.loginRequest.update({
        where: { nonce },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await approve(nonce).expect(422);
    });

    it('refuses a second approval', async () => {
      const { nonce } = await create();
      await approve(nonce).expect(201);
      await approve(nonce, '999').expect(422);

      // And the identity is the first one, not the second — a repeat approval
      // must not be a way to redirect a login to another account.
      const row = await prisma.loginRequest.findUniqueOrThrow({ where: { nonce } });
      expect(row.telegramId).toBe(String(TG));
    });

    it('never issues a session for a declined request', async () => {
      const { nonce, pollSecret } = await create();
      await request(app.getHttpServer())
        .post(`/auth/login-link/${nonce}/decline`)
        .set(bot)
        .expect(201);
      await claim(nonce, pollSecret).expect(401);
      await approve(nonce).expect(422);
    });

    // "Somebody tried to sign in as me" stays findable after the clock runs out.
    it('keeps a declined request declined once it expires', async () => {
      const { nonce } = await create();
      await request(app.getHttpServer())
        .post(`/auth/login-link/${nonce}/decline`)
        .set(bot)
        .expect(201);
      await prisma.loginRequest.update({
        where: { nonce },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const status = await request(app.getHttpServer())
        .get(`/auth/login-link/${nonce}/status`)
        .expect(200);
      expect(status.body.state).toBe('declined');
    });
  });

  describe('what the waiting page can see', () => {
    it('reports the state without giving anything away', async () => {
      const { nonce, pairingCode } = await create();
      const body = (
        await request(app.getHttpServer()).get(`/auth/login-link/${nonce}/status`).expect(200)
      ).body;
      expect(body).toEqual({ state: 'pending', pairingCode });
      // No identity, no secret, no token — a nonce is not a peephole.
      expect(JSON.stringify(body)).not.toContain('telegram');
    });
  });

  /**
   * T-112a. The session used to live in `localStorage`, where any script on the
   * page could read it — so an XSS was a token an attacker could carry away and
   * reuse from their own machine for ninety days.
   */
  describe('the session cookie (T-112a)', () => {
    const cookieFrom = (res: request.Response): string => {
      const header = res.headers['set-cookie'];
      const all = Array.isArray(header) ? header : [header];
      const found = all.find((c) => typeof c === 'string' && c.startsWith('lomi_session='));
      expect(found, 'no session cookie was set').toBeDefined();
      return found as string;
    };

    it('sets an HttpOnly, SameSite=Lax cookie on claim', async () => {
      const { nonce, pollSecret } = await create();
      await approve(nonce).expect(201);
      const cookie = cookieFrom(await claim(nonce, pollSecret).expect(201));

      // HttpOnly is the point; SameSite=Lax is what keeps it from being a
      // downgrade, since a cookie is sent automatically where the old
      // Authorization header never was.
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
    });

    /** T-112a's stated test: a request still authenticates, with no header. */
    it('authenticates on the cookie alone', async () => {
      const { nonce, pollSecret } = await create();
      await approve(nonce).expect(201);
      const cookie = cookieFrom(await claim(nonce, pollSecret).expect(201));

      await request(app.getHttpServer())
        .get('/me/devices')
        .set('Cookie', cookie.split(';')[0]!)
        .expect(200);
    });

    it('refuses a request carrying neither cookie nor header', async () => {
      await request(app.getHttpServer()).get('/me/devices').expect(401);
    });

    /**
     * Sign-out revokes the row **and** clears the cookie.
     *
     * Clearing alone would leave a live session a stolen token could still use;
     * revoking alone would leave the browser sending a dead cookie forever —
     * signed out everywhere except where the student is looking.
     */
    it('signs out by revoking the session and clearing the cookie', async () => {
      const { nonce, pollSecret } = await create();
      await approve(nonce).expect(201);
      const cookie = cookieFrom(await claim(nonce, pollSecret).expect(201)).split(';')[0]!;

      const out = await request(app.getHttpServer())
        .post('/auth/sign-out')
        .set('Cookie', cookie)
        .expect(201);

      const cleared = (
        Array.isArray(out.headers['set-cookie'])
          ? out.headers['set-cookie']
          : [out.headers['set-cookie']]
      ).find((c) => typeof c === 'string' && c.startsWith('lomi_session='));
      expect(cleared).toContain('Max-Age=0');
      // Same attributes, or the browser keeps the old cookie and "signed out"
      // is a lie in the only place it matters.
      expect(cleared).toContain('HttpOnly');
      expect(cleared).toContain('SameSite=Lax');

      // And the row really is revoked, so a token copied earlier is dead too.
      await request(app.getHttpServer()).get('/me/devices').set('Cookie', cookie).expect(401);
    });

    /**
     * The header still works, for callers with nowhere to put a cookie — a
     * webview with cookies blocked, a script. It costs nothing in safety: an XSS
     * cannot read an httpOnly cookie, so it cannot mint a bearer it did not
     * already have.
     */
    it('still accepts a bearer token from a client that has no cookie jar', async () => {
      const { nonce, pollSecret } = await create();
      await approve(nonce).expect(201);
      const body = (await claim(nonce, pollSecret).expect(201)).body;

      await request(app.getHttpServer())
        .get('/me/devices')
        .set({ Authorization: `Bearer ${body.token}` })
        .expect(200);
    });
  });

  describe('rate limiting (T-075)', () => {
    /** T-075's stated test: a 6th request inside the window is refused. */
    it('stops a caller asking for links faster than a person could use them', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).post('/auth/login-link').send({}).expect(201);
      }
      const res = await request(app.getHttpServer()).post('/auth/login-link').send({}).expect(422);
      expect(res.body.error).toBe('TOO_MANY_REQUESTS');
    });
  });
});
