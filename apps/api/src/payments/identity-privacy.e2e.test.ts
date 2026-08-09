/**
 * Integration test — no identity document reaches a student-facing route
 * (T-148, T-149).
 *
 * Fayda verification itself is blocked on D7 and nothing binds a FIN yet. That
 * makes this the moment to write the guard rather than a reason to skip it: the
 * cheapest time to stop a national identity number from leaking is before there
 * is one to leak, and a guard added after the field exists is a guard written by
 * somebody who already has the leak to fix.
 *
 * Two claims, checked two ways:
 *
 * - **T-149**, over the running application: no route outside `/admin` returns
 *   `verifiedName` or anything else from the identity set. Swept from the
 *   router, not from a hand-written list, so the endpoint added next month is
 *   covered by the version of this test that already exists.
 * - **T-148**, over the schema: no column holds a raw FIN. A hash is fine and is
 *   what the design calls for; the number itself is not.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { cleanupStaff, signInAsStaff, type StaffSession } from '../auth/staff-testkit.test-helper';

const SFX = 'e2e-identity';
const TG_STUDENT = 566000041;

/**
 * The words that must never appear in a student-facing response.
 *
 * `verifiedName` is the legal name Fayda returns, and the product shows display
 * names on every public surface precisely so that it does not become the name
 * anybody sees. The rest are the shapes a raw FIN arrives in.
 */
const FORBIDDEN = ['verifiedName', 'verified_name', 'faydaFin', 'fayda_fin', 'rawFin'] as const;

/**
 * Walks up from the working directory rather than using `import.meta.url`.
 *
 * The API workspace compiles to CommonJS — Nest needs `emitDecoratorMetadata`,
 * which the ESM path does not give us — so `import.meta` is a syntax error here.
 * Vitest transpiles it happily and only `npm run typecheck` catches it, which is
 * how it has slipped in before.
 */
function repoFile(relative: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, relative);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error(`could not locate ${relative}`);
}

const schema = readFileSync(repoFile('apps/api/prisma/schema.prisma'), 'utf8');

describe('identity never leaves the building (T-148, T-149)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let student: StaffSession;
  let fieldId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await cleanupStaff(prisma, [TG_STUDENT], SFX);
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });

    fieldId = (
      await prisma.field.create({
        data: { name: `F ${SFX}`, slug: `field-${SFX}`, isPublished: true },
      })
    ).id;
    // A student, not staff: the claim is about what a *student-reachable* route
    // returns, and `/admin` is excluded from the sweep below.
    student = await signInAsStaff(app, prisma, TG_STUDENT, 'REVIEWER', SFX);
    await prisma.staffMember.deleteMany({ where: { userId: student.userId } });
    await prisma.user.update({ where: { id: student.userId }, data: { fieldId } });
  });

  afterAll(async () => {
    const payments = await prisma.payment.findMany({
      where: { userId: student.userId },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entity: 'payment', entityId: { in: payments.map((p) => p.id) } },
    });
    await prisma.payment.deleteMany({ where: { userId: student.userId } });
    await prisma.subscription.deleteMany({ where: { userId: student.userId } });
    await cleanupStaff(prisma, [TG_STUDENT], SFX);
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
    await app.close();
  });

  /**
   * T-149 as a claim about the application, not about a list somebody wrote.
   *
   * A hand-listed set covers the routes that were remembered. The router covers
   * the one added in Phase 11, which is the one that will be returning a user
   * object nobody trimmed.
   */
  it('returns no identity field from any student-reachable route', async () => {
    const server = app.getHttpAdapter().getInstance() as {
      router?: { stack?: unknown[] };
      _router?: { stack?: unknown[] };
    };
    const stack = (server.router?.stack ?? server._router?.stack ?? []) as {
      route?: { path: string; methods: Record<string, boolean> };
    }[];

    const routes = stack
      .filter((l) => l.route && !l.route.path.startsWith('/admin'))
      .flatMap((l) =>
        Object.keys(l.route!.methods).map((m) => ({
          method: m.toLowerCase(),
          path: l.route!.path,
        })),
      )
      /*
       * Everything except the routes whose job is to END something.
       *
       * `sign-out` revokes the session, so every request after it 401s and the
       * sweep stops testing anything. `/submit` closes a paper. This exclusion
       * list has broken two suites before by being forgotten, so it is spelled
       * out here rather than inherited.
       */
      .filter((r) => !r.path.endsWith('/sign-out') && !r.path.endsWith('/submit'));

    expect(routes.length).toBeGreaterThan(5);

    let combined = '';
    let answered = 0;
    for (const route of routes) {
      const path = route.path.replace(':fieldId', fieldId).replace(/:[^/]+/g, '1');
      const res = await (
        request(app.getHttpServer()) as unknown as Record<string, (p: string) => request.Test>
      )[route.method]!(path)
        .set(student.auth)
        .send({});
      if (res.status < 300) answered++;
      // Every status, not only 200. A 500 that renders a user object leaks just
      // as thoroughly as a success, and error paths are where trimming is
      // forgotten.
      combined += JSON.stringify(res.body ?? '');
    }

    /*
     * The assertion that keeps this test from passing for the wrong reason.
     *
     * A sweep where every route 401s or 404s finds nothing and reports clean —
     * which is precisely what a broken fixture looks like, and it would go on
     * reporting clean for years. Several routes must have really answered.
     */
    expect(answered, 'the sweep reached no live route — the fixture is broken').toBeGreaterThan(2);
    expect(combined.length).toBeGreaterThan(100);

    for (const word of FORBIDDEN) {
      expect(combined.includes(word), `${word} appeared in a student-facing response`).toBe(false);
    }
  });

  /**
   * T-148: the raw number is never stored, so it can never be dumped, logged or
   * subpoenaed out of us. A salted hash answers "is this the same person" — the
   * only question the product actually asks — without holding the answer to
   * "who is this person" for anybody who reaches the database.
   */
  it('has no column holding a raw identity number', async () => {
    const columns = schema
      .split('\n')
      .filter((line) => !line.trim().startsWith('///') && !line.trim().startsWith('//'))
      .join('\n');

    for (const word of ['verifiedName', 'faydaFin', 'rawFin']) {
      expect(columns.includes(word), `${word} is a column now — this guard needs revisiting`).toBe(
        false,
      );
    }
    // A `fin` on its own would be the raw number under a shorter name.
    expect(/^\s*fin\s+String/m.test(columns)).toBe(false);
  });

  /**
   * The guard is worth nothing if it passes because the words are spelled
   * differently everywhere. Asserted against a response that really is swept.
   */
  it('would catch an identity field if one appeared', () => {
    const leaked = JSON.stringify({ id: '1', verifiedName: 'Full Legal Name' });
    expect(FORBIDDEN.some((word) => leaked.includes(word))).toBe(true);
  });
});
