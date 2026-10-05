'use client';

/**
 * The admin top bar (design handoff 2g).
 *
 * *"top bar with pill nav (Dashboard / Payments / Import / Weights / Users),
 * content max 1200px."*
 *
 * A bar rather than the student rail, and the difference is not decoration.
 * The student navigation is five destinations a student moves between all day,
 * so it takes the edge of the screen and stays there; admin work is a table
 * that wants every pixel of the 1200px it is allowed, and a 232px rail beside a
 * six-column table is 232px taken from the column that holds a reference
 * number.
 *
 * The same active treatment as the rail — Brand Soft pill, brand label,
 * `aria-current` — because an operator switching between five screens has the
 * same question a student does, and answering it differently in the same
 * product is how two design systems start.
 */
import { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { copy } from '../lib/i18n';
import { SignOutButton } from './SignOutButton';
import { Logo } from './Logo';

const c = copy();

export const ADMIN_DESTINATIONS: readonly { href: string; label: string }[] = [
  { href: '/admin/dashboard', label: c.admin.nav.dashboard },
  { href: '/admin/payments', label: c.admin.nav.payments },
  { href: '/admin/import', label: c.admin.nav.import },
  { href: '/admin/review', label: c.admin.nav.review },
  { href: '/admin/weights', label: c.admin.nav.weights },
  { href: '/admin/users', label: c.admin.nav.users },
  // The moderation queue. Last because it is usually empty, and first would put
  // an empty screen in front of an operator who came to do something else.
  { href: '/admin/community', label: c.admin.nav.moderation },
];

/**
 * The two a provider gets and an admin does not.
 *
 * Appended rather than a separate bar: a provider is also an operator here, and
 * two rows of navigation for one person is two places to look for the thing
 * they want. They are shown only when the server says the role is PROVIDER —
 * rendering them for everybody and letting the 403 explain would put two dead
 * links in front of every admin.
 */
export const PROVIDER_DESTINATIONS: readonly { href: string; label: string }[] = [
  { href: '/provider/activity', label: c.provider.nav.activity },
  { href: '/provider/health', label: c.provider.nav.health },
];

export function AdminBar({ pathname }: { pathname: string }) {
  /** `undefined` while the answer is in flight, `null` for "not staff". */
  const [role, setRole] = useState<'REVIEWER' | 'ADMIN' | 'PROVIDER' | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const held = await api.myStaffRole();
        if (alive) setRole(held.role);
      } catch {
        // Signed out, or the call failed. Treated as not staff: the guard on
        // every one of these routes is what actually decides, and drawing an
        // operator's navigation on a maybe is the thing being fixed here.
        if (alive) setRole(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /*
   * Nothing at all for a student.
   *
   * The bar used to render for anybody who loaded an `/admin` URL, with only
   * the data refused — so a student who guessed the path got the full operator
   * chrome (Dashboard, Payments, Import, Review, Weights, Users) and an error
   * card under it. The reasoning for hiding the two provider links from admins
   * is written six lines above and applies with more force here: navigation
   * that cannot be used is navigation that misleads.
   *
   * Nothing while the answer is in flight either. A bar that appears and then
   * vanishes tells a student exactly what it was going to say.
   */
  if (role === undefined || role === null) return null;

  const destinations =
    role === 'PROVIDER' ? [...ADMIN_DESTINATIONS, ...PROVIDER_DESTINATIONS] : ADMIN_DESTINATIONS;

  return (
    /*
     * The staff bar, on the dark surface (redesign handoff, § Admin).
     *
     * Dark so that nobody mistakes the console for the student app: the two
     * share a palette, and a reviewer who is also a student moves between them
     * many times a day. The same object as the landing's bands and Today's
     * hero, so it uses the `on-deep` inks, all audited against `ink-deep`.
     *
     * The tabs are 44px, not the handoff's 40: the floor holds for staff too.
     */
    <header className="bg-ink-deep on-deep text-on-deep sticky top-0 z-10">
      <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-8">
        <span className="flex items-center gap-2.5">
          <Logo size={30} wordmark onDark />
          {/* Which console this is, said beside the name. */}
          <span className="bg-on-deep/10 text-on-deep-2 rounded-full px-2.5 py-1 text-[12px] font-semibold">
            {role === 'PROVIDER' ? c.provider.nav.badge : c.admin.nav.badge}
          </span>
        </span>

        <nav aria-label={c.admin.nav.label} className="flex flex-wrap gap-0.5">
          {destinations.map((d) => {
            const active = pathname === d.href || pathname.startsWith(`${d.href}/`);
            return (
              <a
                key={d.href}
                href={d.href}
                className={[
                  'rounded-control inline-flex min-h-11 items-center px-3 text-[14px] font-semibold whitespace-nowrap',
                  // The lemon with ink on it, the one fill that reads as "here"
                  // on the dark bar; the weight change is the second signal.
                  active
                    ? 'bg-brand text-on-brand'
                    : 'text-on-deep-2 hover:bg-on-deep/10 hover:text-on-deep',
                ].join(' ')}
                {...(active ? { 'aria-current': 'page' as const } : {})}
              >
                {d.label}
              </a>
            );
          })}
        </nav>

        {/* Both halves of leaving: "the student app" because most staff also
            practise, and Sign out because this is the account that can settle
            payments and retire questions. */}
        <div className="ml-auto flex items-center gap-1">
          <a
            href="/today"
            className="border-on-deep/20 text-on-deep hover:bg-on-deep/10 rounded-control inline-flex min-h-11 items-center border px-3.5 text-[13px] font-semibold"
          >
            {c.admin.nav.backToApp}
          </a>
          <SignOutButton variant="onDark" />
        </div>
      </div>
    </header>
  );
}
