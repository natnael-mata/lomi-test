/**
 * Where a member of staff starts (QA, 2026-10-06).
 *
 * Staff sign in through the same door as students, and every one of them was
 * sent to Today: a student screen, with a "choose your programme" prompt, for
 * somebody who came to review questions. `/admin` itself was a 404. Both now
 * go to the first screen the role can open. Providers outrank admins and get
 * the overview, which they can open too.
 */
import type { StaffRole } from '../components/StaffOnly';

export function staffHome(role: StaffRole | null): string | null {
  if (role === 'ADMIN' || role === 'PROVIDER') return '/admin/dashboard';
  if (role === 'REVIEWER') return '/admin/review';
  return null;
}
