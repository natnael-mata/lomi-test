import { Injectable } from '@nestjs/common';
import { statfsSync } from 'node:fs';
import { freemem, loadavg, totalmem, cpus, uptime as hostUptime } from 'node:os';

import { PrismaService } from '../prisma/prisma.service';

/**
 * How a component is doing.
 *
 * `not_configured` is a first-class state and not a synonym for `down`. SMS is
 * not wired into this product at all; painting it red would put a permanent
 * alarm on a board, and a board with a permanent alarm on it is a board nobody
 * reads. Painting it green would be a lie about a channel that cannot deliver
 * anything.
 */
export type ComponentStatus = 'ok' | 'degraded' | 'down' | 'not_configured';

export interface HealthComponent {
  key: 'database' | 'api' | 'web' | 'security' | 'vps' | 'sms';
  status: ComponentStatus;
  /** The headline figure, already formatted. Null where there is nothing to show. */
  value: string | null;
  /**
   * **What was measured to get that.**
   *
   * Required, not optional. DESIGN.md's rule is that every number on screen is
   * reconstructable, and a status board is where an unexplained figure does the
   * most damage — somebody acts on it at two in the morning.
   */
  derivation: string;
  /** Sub-figures, each with its own label. Shown under the headline. */
  details: { label: string; value: string }[];
  /** Milliseconds this check itself took, where it did any work. */
  latencyMs: number | null;
}

export interface HealthReport {
  checkedAt: string;
  /** The worst status among the components, ignoring `not_configured`. */
  overall: ComponentStatus;
  components: HealthComponent[];
}

/** Above this, a check is slow enough to say so. */
const SLOW_MS = { database: 150, web: 1500 } as const;

/**
 * The live health of everything this product runs on (T-228).
 *
 * **Measured, never assumed.** Every figure here comes from a call made at the
 * moment of asking: the database is timed with a real query, the web app is
 * timed with a real request, the host figures come from the kernel. There is no
 * cache and no background sampler, because a status board showing a number from
 * four minutes ago is worse than one showing nothing — it answers the question
 * "is it up **now**" with an old yes.
 *
 * There is deliberately no metrics store behind this. Storing a time series
 * would make it a monitoring product, and this is a page that answers one
 * question for one person: is anything broken right now. The screen keeps the
 * samples it has collected while it has been open, which is the honest scope of
 * "live" for something with no database of its own.
 */
@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async report(): Promise<HealthReport> {
    const [database, web, security] = await Promise.all([
      this.database(),
      this.web(),
      this.security(),
    ]);
    const components = [database, this.api(), web, security, this.vps(), this.sms()];

    const RANK: Record<ComponentStatus, number> = {
      ok: 0,
      not_configured: 0,
      degraded: 1,
      down: 2,
    };
    const overall = components.reduce<ComponentStatus>(
      (worst, c) => (RANK[c.status] > RANK[worst] ? c.status : worst),
      'ok',
    );

    return { checkedAt: new Date().toISOString(), overall, components };
  }

  /**
   * A real query, not a connection check.
   *
   * `$connect()` succeeding says a socket opened. `SELECT 1` says the database
   * answered — which is the difference between "the box is up" and "queries are
   * being served", and a pooler under pressure passes the first and fails the
   * second.
   */
  private async database(): Promise<HealthComponent> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - started;

      // Counted alongside, because "the database answers" and "the database
      // holds anything" are different questions and a restored-but-empty box
      // passes the first.
      const [students, questions] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.question.count({ where: { status: 'PUBLISHED' } }),
      ]);

      return {
        key: 'database',
        status: latencyMs > SLOW_MS.database ? 'degraded' : 'ok',
        value: `${latencyMs} ms`,
        derivation: 'time for the database to answer SELECT 1, measured just now',
        details: [
          { label: 'Accounts', value: String(students) },
          { label: 'Published questions', value: String(questions) },
        ],
        latencyMs,
      };
    } catch (error) {
      return {
        key: 'database',
        status: 'down',
        value: null,
        derivation: 'SELECT 1 did not return',
        details: [{ label: 'Error', value: message(error) }],
        latencyMs: Date.now() - started,
      };
    }
  }

  /** This process. Nothing is measured here that is not already in memory. */
  private api(): HealthComponent {
    const memory = process.memoryUsage();
    const heapMb = Math.round(memory.heapUsed / 1024 / 1024);
    const rssMb = Math.round(memory.rss / 1024 / 1024);
    const up = Math.round(process.uptime());

    return {
      key: 'api',
      status: 'ok',
      value: duration(up),
      derivation: 'process uptime, read from this Node process',
      details: [
        { label: 'Heap used', value: `${heapMb} MB` },
        { label: 'Resident', value: `${rssMb} MB` },
        { label: 'Node', value: process.version },
      ],
      latencyMs: null,
    };
  }

  /**
   * The front end, fetched over the network like a student would.
   *
   * The API asking the web app for a page is the only check that exercises what
   * is actually between them — the rewrite, the port, the process being up. A
   * flag in configuration saying the front end exists proves nothing.
   */
  private async web(): Promise<HealthComponent> {
    const url = process.env.WEB_BASE_URL ?? 'http://localhost:3100';
    const started = Date.now();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        redirect: 'manual',
      });
      const latencyMs = Date.now() - started;
      const served = response.status < 400 || response.status === 404;
      return {
        key: 'web',
        status: !served ? 'down' : latencyMs > SLOW_MS.web ? 'degraded' : 'ok',
        value: `${latencyMs} ms`,
        derivation: `GET ${url} from this server, just now`,
        details: [{ label: 'Answered', value: String(response.status) }],
        latencyMs,
      };
    } catch (error) {
      return {
        key: 'web',
        status: 'down',
        value: null,
        derivation: `GET ${url} from this server`,
        details: [{ label: 'Error', value: message(error) }],
        latencyMs: Date.now() - started,
      };
    }
  }

  /**
   * What has happened that somebody should look at.
   *
   * **Counts, not judgements.** "Security: OK" is a claim this code is in no
   * position to make. What it can say is how many sessions were ended in the
   * last day, how many accounts are closed, and how many staff actions were
   * taken — and let the person reading decide whether that is the number they
   * expected. A board that says everything is fine is a board that stops being
   * read.
   */
  private async security(): Promise<HealthComponent> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const started = Date.now();

    const [revoked, deactivated, staffActions, liveSessions, staffCount] = await Promise.all([
      this.prisma.session.count({ where: { revokedAt: { gte: since } } }),
      this.prisma.user.count({ where: { deactivatedAt: { not: null } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.session.count({ where: { revokedAt: null } }),
      this.prisma.staffMember.count(),
    ]);

    // The one thing here that IS a judgement, and a narrow one: the smoke-test
    // door is an authentication bypass, and it being open is a fact about this
    // server rather than an opinion about it.
    const devDoorOpen = (process.env.DEV_LOGIN_SECRET ?? '').length > 0;

    return {
      key: 'security',
      status: devDoorOpen ? 'degraded' : 'ok',
      value: devDoorOpen ? 'Testing sign-in is open' : 'Telegram only',
      derivation: devDoorOpen
        ? 'DEV_LOGIN_SECRET is set on this server, so /auth/dev-login will mint accounts'
        : 'DEV_LOGIN_SECRET is unset, so the only way in is the Telegram deep link',
      details: [
        { label: 'Live sessions', value: String(liveSessions) },
        { label: 'Ended in 24h', value: String(revoked) },
        { label: 'Staff actions in 24h', value: String(staffActions) },
        { label: 'Closed accounts', value: String(deactivated) },
        { label: 'Staff', value: String(staffCount) },
      ],
      latencyMs: Date.now() - started,
    };
  }

  /**
   * The machine this process is on.
   *
   * Load is reported **per core**, because a load average of 4 means something
   * different on a one-core VPS than on an eight-core one, and the raw number
   * invites the wrong reading on whichever box you are not thinking about.
   */
  private vps(): HealthComponent {
    const cores = cpus().length || 1;
    const [oneMinute] = loadavg();
    const perCore = (oneMinute ?? 0) / cores;
    const total = totalmem();
    const usedPct = Math.round(((total - freemem()) / total) * 100);

    let disk: { usedPct: number; freeGb: number } | null = null;
    try {
      const fs = statfsSync('/');
      const size = fs.blocks * fs.bsize;
      const free = fs.bavail * fs.bsize;
      disk = { usedPct: Math.round(((size - free) / size) * 100), freeGb: free / 1024 ** 3 };
    } catch {
      // A container without the syscall. Reporting nothing beats reporting zero,
      // which reads as a full disk.
    }

    const strained = perCore > 1 || usedPct > 90 || (disk?.usedPct ?? 0) > 90;

    return {
      key: 'vps',
      status: strained ? 'degraded' : 'ok',
      value: `${Math.round(usedPct)}% memory`,
      derivation: `memory in use of ${Math.round(total / 1024 ** 3)} GB, read from the kernel`,
      details: [
        { label: 'Load per core', value: perCore.toFixed(2) },
        { label: 'Cores', value: String(cores) },
        { label: 'Host uptime', value: duration(Math.round(hostUptime())) },
        ...(disk
          ? [
              { label: 'Disk used', value: `${disk.usedPct}%` },
              { label: 'Disk free', value: `${disk.freeGb.toFixed(1)} GB` },
            ]
          : [{ label: 'Disk', value: 'not readable here' }]),
      ],
      latencyMs: null,
    };
  }

  /**
   * SMS.
   *
   * **There is no SMS in this product**, and this component exists to say so
   * rather than to leave a gap somebody fills in with an assumption. Every
   * message the product sends goes through Telegram; SMS was asked about, is not
   * built, and the honest report is `not_configured` with the reason attached.
   *
   * The moment a provider is wired in, this reads its configuration and starts
   * saying something else. Until then it is the only kind of green that would be
   * a lie.
   */
  private sms(): HealthComponent {
    const configured = (process.env.SMS_PROVIDER ?? '').length > 0;
    return {
      key: 'sms',
      status: configured ? 'ok' : 'not_configured',
      value: configured ? (process.env.SMS_PROVIDER ?? null) : null,
      derivation: configured
        ? 'SMS_PROVIDER is set on this server'
        : 'no SMS provider is configured — the product notifies through Telegram',
      details: [],
      latencyMs: null,
    };
  }
}

function message(error: unknown): string {
  // Truncated: a driver error can be a paragraph, and a status board is not
  // where somebody reads a stack trace.
  return (error instanceof Error ? error.message : String(error)).slice(0, 160);
}

/** `3d 4h`, `2h 11m`, `47s`. Coarse on purpose — nobody reads uptime to the second. */
function duration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
