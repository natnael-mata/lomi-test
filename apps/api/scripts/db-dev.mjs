/**
 * Dev Postgres with no Docker and no system install.
 *
 * `embedded-postgres` ships real Postgres binaries in node_modules and keeps
 * cluster data in apps/api/.pgdata (gitignored). Runs on 5433 because 5432 is
 * taken by the system Postgres on this machine.
 *
 * Stays in the foreground: run it in its own terminal and Ctrl-C to stop.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import EmbeddedPostgres from 'embedded-postgres';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '..', '.pgdata');

const PORT = Number(process.env.PGPORT ?? 5433);
const USER = process.env.PGUSER ?? 'postgres';
const PASSWORD = process.env.PGPASSWORD ?? 'postgres';
const DATABASE = process.env.PGDATABASE ?? 'lomi_test';

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

// initialise() refuses to run over an existing cluster, so only do it once.
const alreadyInitialised = existsSync(resolve(DATA_DIR, 'PG_VERSION'));

if (!alreadyInitialised) {
  console.log(`initialising cluster in ${DATA_DIR} …`);
  await pg.initialise();
}

await pg.start();
console.log(`postgres up on :${PORT}`);

// createDatabase throws if it exists; that is fine on every run after the first.
try {
  await pg.createDatabase(DATABASE);
  console.log(`created database "${DATABASE}"`);
} catch {
  console.log(`database "${DATABASE}" already present`);
}

console.log(
  `DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}\n` +
    'ready — Ctrl-C to stop',
);

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    console.log('\nstopping postgres …');
    pg.stop()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('failed to stop cleanly:', err);
        process.exit(1);
      });
  });
}

// Hold the process open; the cluster runs as a child of this script.
setInterval(() => {}, 1 << 30);
