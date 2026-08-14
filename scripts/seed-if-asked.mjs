#!/usr/bin/env node
/**
 * Seeds the taxonomy on boot, but only when explicitly asked (AletCloud).
 *
 * **Why this exists at all.** The managed database has no public endpoint —
 * `publicAccess: false`, no external IP, and no control-plane call to change
 * that. So nothing outside the cluster can reach it, including every tool that
 * would normally seed a fresh environment. The application container is the only
 * thing that can, which makes boot the only available moment.
 *
 * **Off unless `SEED_ON_BOOT` is set.** No default, no inference from
 * `NODE_ENV`. Set it, deploy once, unset it, deploy again — the same shape as
 * the smoke-test door, and for the same reason: a thing that writes to the
 * database on every boot is a thing that will one day write to the wrong one.
 *
 * **Never fatal.** A seed failure must not stop the API serving. The seed is
 * convenience; the API is the product. It logs loudly and exits 0 either way.
 *
 * The seed itself is idempotent — `seed.ts` upserts fields and `seed-questions`
 * runs the real importer, which upserts on `stableId` (T-055).
 */
import { spawnSync } from 'node:child_process';

const asked = process.env.SEED_ON_BOOT?.trim();

if (!asked) process.exit(0);

console.warn('[seed-if-asked] SEED_ON_BOOT is set — seeding the taxonomy before start.');

const result = spawnSync('npm', ['run', 'db:seed'], {
  stdio: 'inherit',
  // From apps/api, where the hosted start script runs, up to the workspace root.
  cwd: new URL('..', import.meta.url).pathname,
  env: process.env,
});

if (result.status !== 0) {
  // Loud, and not fatal. A half-seeded database is a content problem; a database
  // the API refuses to start against is an outage.
  console.warn(
    `[seed-if-asked] seeding exited ${result.status}. Starting anyway — the API is the product, the seed is convenience.`,
  );
}

console.warn('[seed-if-asked] done. Unset SEED_ON_BOOT and redeploy once the data is in.');
process.exit(0);
