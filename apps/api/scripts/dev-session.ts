/**
 * Mints a session token for local testing.
 *
 * A SCRIPT, not an endpoint, and that distinction is the whole point. A
 * `/auth/dev-login` route — however carefully guarded by `NODE_ENV` — is an
 * authentication bypass that ships in the bundle and is one misconfigured
 * environment variable from being live. This runs only where someone already has
 * a shell and the database password, which is to say: where they could mint a
 * row by hand anyway.
 *
 *   npm run dev:session -w api               # first published field
 *   npm run dev:session -w api -- computer-science
 *
 * Prints a token and the one-liner that installs it in the browser.
 */
import { PrismaClient } from '@prisma/client';

import { generateDisplayName } from '../src/auth/display-name';
import { signSessionToken } from '../src/auth/tokens';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const secret = process.env.JWT_SECRET ?? '';
  if (secret === '') {
    console.error('JWT_SECRET is not set — refusing to sign a token.');
    process.exitCode = 1;
    return;
  }

  const slug = process.argv[2];
  const field = slug
    ? await prisma.field.findUnique({ where: { slug } })
    : await prisma.field.findFirst({ where: { isPublished: true }, orderBy: { name: 'asc' } });

  if (!field) {
    console.error(slug ? `No field with slug "${slug}".` : 'No published field to practise in.');
    process.exitCode = 1;
    return;
  }
  if (!field.isPublished) {
    console.error(`Field "${field.name}" is not published — nothing in it is servable.`);
    process.exitCode = 1;
    return;
  }

  const telegramId = 'dev-local-session';
  const user =
    (await prisma.user.findUnique({ where: { telegramId } })) ??
    (await prisma.user.create({
      data: { telegramId, displayName: generateDisplayName(), name: 'Local dev' },
    }));

  await prisma.user.update({ where: { id: user.id }, data: { fieldId: field.id } });

  const session = await prisma.session.create({
    data: { userId: user.id, deviceLabel: 'dev-session script' },
  });
  const token = signSessionToken({ sub: user.id, sid: session.id }, secret);

  const published = await prisma.question.count({
    where: { fieldId: field.id, status: 'PUBLISHED' },
  });
  const attempts = await prisma.attempt.count({ where: { userId: user.id, fieldId: field.id } });

  console.log(`field:            ${field.name} (${field.slug})`);
  console.log(`published questions: ${published}`);
  console.log(`attempts so far:  ${attempts}`);
  console.log(`user:             ${user.id}`);
  console.log(`session:          ${session.id}`);
  console.log('');
  console.log('Paste into the browser console at http://localhost:3100 :');
  console.log(`  localStorage.setItem('lomi-session', ${JSON.stringify(token)})`);

  if (published === 0) {
    console.log('');
    console.log('WARNING: this field has no PUBLISHED questions, so /questions/next will 404.');
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
