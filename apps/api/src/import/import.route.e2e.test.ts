/**
 * Integration test — the import route over HTTP (T-053, T-235).
 *
 * **The import module had thorough tests and no HTTP test at all.** Every one of
 * them called `ImportService` directly, so all of them agreed that a malformed
 * file throws `CsvError` — and none of them ever saw what an operator got when
 * it did. `CsvError` is a plain `Error`, which Nest converts to a bare
 * `{"statusCode":500,"message":"Internal server error"}`. The person who
 * renamed a column or left a quote open was told the server had broken.
 *
 * So this suite is deliberately about the seam rather than the parsing: the
 * status, the words, and the guard. The parser's own behaviour is already
 * covered in `parse-csv.test.ts` and does not need repeating here.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { IMPORT_COLUMNS } from './csv-schema';
import {
  TEST_BOT_TOKEN,
  TEST_JWT_SECRET,
  cleanupStaff,
  signInAsStaff,
  testInitData,
  type StaffSession,
} from '../auth/staff-testkit.test-helper';

const SFX = 'e2e-import-route';
const TG_ADMIN = 566000091;
const TG_STUDENT = 566000092;

/** The header the importer expects, taken from the template it ships. */
const HEADER = IMPORT_COLUMNS.join(',');

// Seventeen cells: this suite carries the full header, so it is the one that
// exercises `source_grade`. The value is blank because "Route Test" is not a
// school track — a grade on it would be rejected, which its own test covers.
const GOOD_ROW =
  `ROUTE-${SFX}-1,Route Test ${SFX},Course,Topic,Two plus two?,,` +
  'three,four,five,six,B,Because it is four.,2,Test,2016,draft,';

describe('POST /admin/questions/import (T-235)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: StaffSession;
  let studentToken = '';

  const wipe = async (): Promise<void> => {
    await prisma.option.deleteMany({
      where: { question: { stableId: { startsWith: `ROUTE-${SFX}` } } },
    });
    await prisma.question.deleteMany({ where: { stableId: { startsWith: `ROUTE-${SFX}` } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: `Route Test ${SFX}` } } } });
    await prisma.course.deleteMany({ where: { field: { name: `Route Test ${SFX}` } } });
    await prisma.field.deleteMany({ where: { name: `Route Test ${SFX}` } });
    await cleanupStaff(prisma, [TG_ADMIN, TG_STUDENT], SFX);
  };

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();

    admin = await signInAsStaff(app, prisma, TG_ADMIN, 'ADMIN', SFX);
    const student = await request(app.getHttpServer())
      .post('/auth/telegram')
      .send({ initData: testInitData(TG_STUDENT) })
      .expect(201);
    studentToken = student.body.token;
  });

  afterAll(async () => {
    await wipe();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  const upload = (csv: string, token: string) =>
    request(app.getHttpServer())
      .post('/admin/questions/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ csv });

  it('imports a well-formed file', async () => {
    const res = await upload(`${HEADER}\n${GOOD_ROW}`, admin.auth.Authorization.slice(7));
    expect(res.status).toBe(201);
    expect(res.body.read).toBe(1);
    expect(res.body.created).toBe(1);
    expect(res.body.rejected).toBe(0);
  });

  /*
   * The three shapes a file can be broken in, and none of them is a server
   * fault. Each is asserted for its status *and* for saying something — a 422
   * whose body is empty is the same dead end as the 500 was.
   */
  const BROKEN: [string, string][] = [
    ['an unterminated quote', `${HEADER}\nROUTE-x,"Route Test`],
    ['a header that is not the schema', 'name,answer\nfoo,B'],
    ['an empty file', ''],
  ];

  for (const [what, csv] of BROKEN) {
    it(`refuses ${what} with 422 and an explanation, not a 500`, async () => {
      const res = await upload(csv, admin.auth.Authorization.slice(7));
      expect(res.status).toBe(422);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(20);
      // Nest's default body for an unhandled throw. Its presence anywhere here
      // means the error escaped again.
      expect(res.text).not.toContain('Internal server error');
    });
  }

  it('names the line when the parser knows it', async () => {
    const res = await upload('name,answer\nfoo,B', admin.auth.Authorization.slice(7));
    expect(res.body.message).toContain('line 1');
  });

  it('writes nothing when the file cannot be read', async () => {
    const before = await prisma.question.count();
    await upload(`${HEADER}\nROUTE-y,"unclosed`, admin.auth.Authorization.slice(7));
    expect(await prisma.question.count()).toBe(before);
  });

  it('still refuses a student, malformed file or not', async () => {
    expect((await upload('', studentToken)).status).toBe(403);
    expect((await upload(`${HEADER}\n${GOOD_ROW}`, studentToken)).status).toBe(403);
  });
});
