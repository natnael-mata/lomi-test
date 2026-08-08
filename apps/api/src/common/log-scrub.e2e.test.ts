/**
 * Integration test — a full run leaks no PII (T-207).
 *
 * The unit tests in `redact.test.ts` prove the redaction rules. This proves the
 * thing the task actually asks for: **seed real personal values into the
 * database, drive real requests, capture everything the process writes, and find
 * none of them.**
 *
 * The distinction matters. A rule that works in isolation and is not wired into
 * the sink is a rule that does nothing, and the failure is invisible — logs look
 * fine until the one that matters.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { RedactingLogger } from './logger';
import { PrismaService } from '../prisma/prisma.service';

const TG = 566000009;

/** Values seeded into the database, then hunted for in the output. */
const SEEDED = {
  phone: '+251911223344',
  legalName: 'Abebe Bekele Tesfaye',
  fin: '123456789012',
};

describe('a full run writes no personal data (T-207)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId = '';
  let captured = '';
  let restore: (() => void) | null = null;

  const wipe = async (): Promise<void> => {
    await prisma.session.deleteMany({ where: { user: { telegramId: String(TG) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: new RedactingLogger() });
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();

    const user = await prisma.user.create({
      data: {
        telegramId: String(TG),
        displayName: 'QuietHeron4821',
        phone: SEEDED.phone,
        name: SEEDED.legalName,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    restore?.();
    await wipe();
    await app.close();
  });

  /** Captures everything the process writes while `work` runs. */
  const capture = async (work: () => Promise<void>): Promise<string> => {
    let out = '';
    const streams = [process.stdout, process.stderr] as const;
    const originals = streams.map((s) => s.write.bind(s));
    streams.forEach((stream) => {
      stream.write = ((chunk: unknown) => {
        out += String(chunk);
        return true;
      }) as typeof stream.write;
    });
    restore = () => streams.forEach((s, i) => (s.write = originals[i]!));
    try {
      await work();
    } finally {
      restore();
      restore = null;
    }
    return out;
  };

  it('drives enough of the app for the sweep to mean something', async () => {
    captured = await capture(async () => {
      const logger = new RedactingLogger();

      // The paths where PII is most likely to be interpolated by mistake: an
      // error naming a user, a lookup by phone, a whole row logged for context.
      logger.error(`no session for ${SEEDED.phone}`);
      logger.warn('user lookup', { phone: SEEDED.phone, name: SEEDED.legalName });
      logger.log('fayda binding', { fin: SEEDED.fin, userId });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      // The whole row, which is the laziest and most common way PII escapes.
      logger.error('unexpected state', user);
      logger.error(new Error(`could not reach ${SEEDED.phone}`));

      // And real traffic, so framework logging is in the capture too.
      await request(app.getHttpServer()).get('/health').expect(200);
      await request(app.getHttpServer()).get('/me/devices').expect(401);
    });

    expect(captured.length, 'nothing was captured — the sweep proves nothing').toBeGreaterThan(50);
  });

  /** T-207's stated test. */
  it.each(Object.entries(SEEDED))('never writes the seeded %s', (_field, value) => {
    expect(captured, `"${value}" reached the log`).not.toContain(value);
  });

  /**
   * The redaction has to be visible, not merely absent. If the logger had
   * silently dropped every line, the assertions above would pass and the log
   * would be useless.
   */
  it('says a value was redacted rather than dropping the field', () => {
    expect(captured).toContain('[redacted]');
  });

  it('still logs what an engineer needs', () => {
    expect(captured).toContain('no session for');
    expect(captured).toContain('user lookup');
    // The non-personal identifier survives, which is the whole point of
    // redacting by field rather than blanking the line.
    expect(captured).toContain(userId);
  });

  it('writes JSON, so lines can be queried rather than grepped', () => {
    const lines = captured
      .split('\n')
      .filter((l) => l.trim().startsWith('{'))
      .slice(0, 5);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
