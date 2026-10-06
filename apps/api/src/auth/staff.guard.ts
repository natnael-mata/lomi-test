import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthedRequest } from './session.guard';

/**
 * Guards `/admin/*`.
 *
 * **This closed a real hole.** Every admin route shipped unguarded: an
 * unauthenticated `GET /admin/review/next` returned a full `answerView` —
 * `correctLabel`, the concept line, every why-wrong — and `POST
 * /admin/questions/:id/publish` and `/retire` were open to anyone who could
 * reach the port. The entire question bank, which is the product's only asset,
 * was readable and mutable by a stranger. It was demonstrated with `curl` before
 * this file existed.
 *
 * Runs **after** `SessionGuard`, which puts the caller on the request. Being
 * signed in is not enough: staff is an explicit list (`StaffMember`), and the
 * empty state is nobody.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  /** Overridden per route by `RequireAdmin`; the default is the weaker one. */
  protected readonly required: StaffRole = 'REVIEWER';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.auth) {
      // Only reachable if this guard is wired without SessionGuard in front of
      // it. Fail closed and say so, rather than treating "no caller" as "no
      // check needed" — which is exactly the shape of the bug this replaces.
      throw new ForbiddenException('StaffGuard needs SessionGuard in front of it.');
    }

    const staff = await this.prisma.staffMember.findUnique({
      where: { userId: req.auth.userId },
      select: { role: true },
    });

    // One message for "not staff" and "not senior enough". Which of the two
    // applies tells a prober whether they have found a real reviewer account.
    if (!staff || !satisfies(staff.role, this.required)) {
      throw new ForbiddenException('This endpoint is for staff only.');
    }

    req.staffRole = staff.role;
    return true;
  }
}

/** Publishing and retiring put text in front of students, or take it away. */
@Injectable()
export class AdminGuard extends StaffGuard {
  protected override readonly required: StaffRole = 'ADMIN';
}

/**
 * The activity log and the health board.
 *
 * A separate guard rather than a flag on `AdminGuard`, because the question it
 * answers is different: ADMIN asks "may you change this", PROVIDER asks "may you
 * see who changed it". Somebody who settles payments should not automatically be
 * able to read the record of everybody who settles payments.
 */
@Injectable()
export class ProviderGuard extends StaffGuard {
  protected override readonly required: StaffRole = 'PROVIDER';
}

/**
 * Whether a held role satisfies a required one.
 *
 * Three levels, each containing the one below: PROVIDER ⊃ ADMIN ⊃ REVIEWER.
 *
 * **Written as an explicit rank rather than a chain of `||`.** The two-role
 * version was two `if`s and adding a third role to it would have been one
 * forgotten clause away from an ADMIN satisfying a PROVIDER requirement — which
 * is the failure that makes the audit log readable by the people it audits.
 */
const RANK: Record<StaffRole, number> = { REVIEWER: 1, ADMIN: 2, PROVIDER: 3 };

export function satisfies(held: StaffRole, required: StaffRole): boolean {
  return RANK[held] >= RANK[required];
}
