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
import { Logo } from './Logo';

const c = copy();

export const ADMIN_DESTINATIONS: readonly { href: string; label: string }[] = [
  { href: '/admin/dashboard', label: c.admin.nav.dashboard },
  { href: '/admin/payments', label: c.admin.nav.payments },
  { href: '/admin/import', label: c.admin.nav.import },
  { href: '/admin/review', label: c.admin.nav.review },
  { href: '/admin/weights', label: c.admin.nav.weights },
  { href: '/admin/users', label: c.admin.nav.users },
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
  const [provider, setProvider] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { role } = await api.myStaffRole();
        if (alive) setProvider(role === 'PROVIDER');
      } catch {
        // Signed out, or not staff. The guard on every one of these routes is
        // the thing that actually decides; this only chooses what to draw.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const destinations = provider
    ? [...ADMIN_DESTINATIONS, ...PROVIDER_DESTINATIONS]
    : ADMIN_DESTINATIONS;

  return (
    <header className="bg-surface border-border sticky top-0 z-10 border-b">
      <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-8">
        <span className="flex items-center gap-2.5">
          <Logo size={34} />
          {/* Named as admin, so nobody reading over a shoulder mistakes an
              operator's screen for the student product. */}
          <span className="font-display text-[18px] font-bold -tracking-[0.02em]">
            {c.admin.nav.title}
          </span>
        </span>

        <nav aria-label={c.admin.nav.label} className="flex flex-wrap gap-1">
          {destinations.map((d) => {
            const active = pathname === d.href || pathname.startsWith(`${d.href}/`);
            return (
              <a
                key={d.href}
                href={d.href}
                className={[
                  // 44px, not the 36 that `py-2` gives. Admin is mostly a
                  // laptop surface and the temptation is to treat the touch
                  // floor as a phone rule — but the operator settling payments
                  // on a tablet is the same person, and DESIGN.md sets the floor
                  // for controls, not for devices.
                  'text-label inline-flex min-h-11 items-center rounded-full px-3.5',
                  active ? 'bg-brand-soft text-brand' : 'text-ink-2',
                ].join(' ')}
                {...(active ? { 'aria-current': 'page' as const } : {})}
              >
                {d.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
