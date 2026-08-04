/**
 * Grants staff access, for local development and for bootstrapping production.
 *
 * `/admin/*` is staff-only and staff is an explicit list, so a fresh database has
 * **nobody** who can review or publish. Something has to create the first row,
 * and it must not be an endpoint: a self-service "make me an admin" route is the
 * hole this whole change closed.
 *
 *   npm run dev:staff -w api -- <userId> ADMIN
 *   npm run dev:staff -w api -- --list
 *
 * Requires a shell and the database password, which is the same bar as writing
 * the row by hand.
 */
import { PrismaClient, type StaffRole } from '@prisma/client';

const prisma = new PrismaClient();

function isRole(value: string): value is StaffRole {
  return value === 'REVIEWER' || value === 'ADMIN';
}

async function main(): Promise<void> {
  const [first, second] = process.argv.slice(2);

  if (first === '--list' || first === undefined) {
    const staff = await prisma.staffMember.findMany({ orderBy: { createdAt: 'asc' } });
    if (staff.length === 0) {
      console.log('No staff. Nobody can reach /admin/* — grant someone:');
      console.log('  npm run dev:staff -w api -- <userId> ADMIN');
      return;
    }
    for (const member of staff) {
      const user = await prisma.user.findUnique({
        where: { id: member.userId },
        select: { displayName: true, telegramId: true, phone: true },
      });
      console.log(
        `${member.role.padEnd(8)} ${member.userId}  ${user?.displayName ?? '(no such user)'}` +
          `  granted by ${member.grantedBy}`,
      );
    }
    return;
  }

  const role = second ?? 'REVIEWER';
  if (!isRole(role)) {
    console.error(`Role must be REVIEWER or ADMIN, got "${role}".`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: first } });
  if (!user) {
    // Refused rather than created: granting staff to an id that does not exist
    // is almost always a typo, and the row would sit there matching nobody until
    // that cuid was coincidentally issued.
    console.error(`No user ${first}. Sign in first, then grant.`);
    process.exitCode = 1;
    return;
  }

  const member = await prisma.staffMember.upsert({
    where: { userId: user.id },
    update: { role },
    create: { userId: user.id, role, grantedBy: 'dev-staff script' },
  });

  console.log(`${user.displayName} (${user.id}) is now ${member.role}.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
