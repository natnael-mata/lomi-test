/**
 * The authentication bypass is gone, and stays gone (T-206a).
 *
 * **This file used to test that the door worked.** `POST /auth/dev-login` took a
 * shared secret and returned a session with no password involved — an
 * authentication bypass, listed as a launch blocker from the day it was
 * written. It existed because Telegram deep-link was once the only way in,
 * which made clicking through a freshly deployed box impossible without a bot,
 * a token and a phone.
 *
 * Phone-and-password sign-in removed that excuse, so the route, the service
 * method, `DEV_LOGIN_SECRET`, and the constant-time secret comparison behind it
 * were all deleted.
 *
 * What is tested now is the absence. A deleted endpoint needs a guard more than
 * a live one does: nobody notices a route quietly coming back, and the reasons
 * it was convenient have not changed — the next person setting up a demo box
 * will feel exactly the pull that put it there in the first place. If these
 * fail, an authentication bypass has been reintroduced.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { TEST_JWT_SECRET } from './staff-testkit.test-helper';

describe('the smoke-test door is gone (T-206a)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DEV_LOGIN_SECRET;
  });

  it('has no dev-login route at all', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ secret: 'x'.repeat(64), label: 'userc' });

    // 404, not 401. A 401 would mean the route still exists and is merely
    // refusing today's secret, which is one environment variable from open.
    expect(res.status).toBe(404);
  });

  /*
   * THE test. The variable was the whole lock, and the failure mode it guarded
   * against was somebody setting it on a public box. Setting it must now do
   * nothing whatsoever.
   */
  it('cannot be reopened by setting the old secret', async () => {
    process.env.DEV_LOGIN_SECRET = 'x'.repeat(64);

    const res = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ secret: 'x'.repeat(64), label: 'userc' });

    expect(res.status).toBe(404);
    expect(String(res.headers['set-cookie'] ?? '')).not.toContain('lomi_session');
  });

  it('leaves sign-in as the only way to get a session', async () => {
    // A wrong password is refused by the real door, which is the point: there
    // is now exactly one way in and it checks a password.
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ phone: '0913000123', password: 'not-the-password' });

    expect(res.status).toBe(401);
    expect(String(res.headers['set-cookie'] ?? '')).not.toContain('lomi_session');
  });
});
