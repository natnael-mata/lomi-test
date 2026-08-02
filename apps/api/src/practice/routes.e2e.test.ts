/**
 * Route inventory (T-107).
 *
 * "No bulk question endpoint exists" is a claim about the **whole application**,
 * not about a file, so it is checked against the router Nest actually built. A
 * grep over source would miss a route added by a library, and a reviewer reading
 * one controller cannot see the other nine.
 *
 * The question bank is the product's asset. One endpoint serves one question;
 * anything that returns many with answer content attached is a way to copy it.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';

interface Route {
  method: string;
  path: string;
}

describe('the route table (T-107)', () => {
  let app: INestApplication;
  let routes: Route[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    // Express keeps its router on the underlying instance; this is the real
    // table, after every controller and every module has registered.
    const server = app.getHttpAdapter().getInstance() as {
      router?: { stack?: unknown[] };
      _router?: { stack?: unknown[] };
    };
    const stack = (server.router?.stack ?? server._router?.stack ?? []) as {
      route?: { path: string; methods: Record<string, boolean> };
    }[];

    routes = stack
      .filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys(layer.route!.methods).map((method) => ({
          method: method.toUpperCase(),
          path: layer.route!.path,
        })),
      );
  });

  afterAll(async () => {
    await app.close();
  });

  it('was read successfully', () => {
    // Guards the reflection: an empty table would make every claim below pass.
    expect(routes.length).toBeGreaterThan(5);
    expect(routes.some((r) => r.path === '/questions/next')).toBe(true);
  });

  it('exposes exactly one question-serving route', () => {
    const serving = routes.filter((r) => r.path.startsWith('/questions'));
    expect(serving.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /questions/next']);
  });

  // The shapes a bulk endpoint takes: a collection route, or a parameterised
  // one that a caller can walk.
  it('has no question collection or by-id route', () => {
    const bulk = routes.filter(
      (r) =>
        /^\/questions\/?$/.test(r.path) ||
        /^\/questions\/:[^/]+$/.test(r.path) ||
        /^\/questions\/(all|list|export|search)/.test(r.path),
    );
    expect(bulk.map((r) => `${r.method} ${r.path}`)).toEqual([]);
  });

  it('keeps every admin question route under /admin', () => {
    // Admin routes DO carry answer content — that is their job. What matters is
    // that none of them is reachable from a student-facing path.
    const answerBearing = routes.filter(
      (r) => /question|review/.test(r.path) && !r.path.startsWith('/admin'),
    );
    expect(answerBearing.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /questions/next']);
  });
});
