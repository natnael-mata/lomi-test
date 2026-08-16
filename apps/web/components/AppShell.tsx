'use client';

/**
 * The frame every screen sits in (DESIGN.md § Layout, § Navigation).
 *
 * DESIGN.md, verbatim: *"Student content sets to a **640px** measure on desktop
 * and fills the viewport on a phone; admin sets to **1200px** and is permitted
 * real tables."*
 *
 * So the measure is decided here, once, from the path — rather than by each page
 * choosing its own `max-w-*`, which is how the whole product ended up at 448px
 * while the document said 640.
 *
 * The navigation comes from the same place for the same reason: five
 * destinations, and no page gets to opt out or disagree. Which *shape* those
 * five take is the responsive question, and it is answered in `Navigation.tsx`;
 * what is decided here is only how much room the furniture needs — 104px of
 * rail on a tablet, 232px on a desktop, and clearance at the bottom of a phone
 * so the last control on every screen is not underneath the bar.
 */
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { AdminBar } from './AdminBar';
import { BottomBar, SideRail } from './Navigation';

/** Admin is permitted real tables and the room to show them. */
const ADMIN_MEASURE = 'max-w-[1200px]';
/** Student reading measure. 640px on desktop; the viewport on a phone. */
const STUDENT_MEASURE = 'max-w-[640px]';

/**
 * Screens that are deliberately outside the frame.
 *
 * Sign-in is the first of these and the reason the list exists: navigation to
 * five destinations, shown to somebody who cannot reach any of them, is an
 * invitation to five sign-in walls. The design gallery is a specimen sheet
 * rather than a student screen, and the testing door exists to get *into* the
 * product — wrapping either in the product's own navigation would be a lie
 * about where somebody is.
 */
const UNFRAMED = ['/design', '/dev-login', '/signin'];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';

  if (UNFRAMED.some((p) => pathname.startsWith(p))) {
    return <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col p-4">{children}</main>;
  }

  if (pathname.startsWith('/admin')) {
    return (
      <>
        <AdminBar pathname={pathname} />
        <main className={`mx-auto flex min-h-dvh flex-col gap-4 p-4 sm:p-8 ${ADMIN_MEASURE}`}>
          {children}
        </main>
      </>
    );
  }

  return (
    <>
      <SideRail pathname={pathname} />
      <BottomBar pathname={pathname} />

      {/* Room for the furniture: 104px of rail from `sm`, 232px from `lg`, and
          bottom clearance on a phone for the 56px bar plus its safe area. */}
      <div className="pb-24 sm:pb-0 sm:pl-26 lg:pl-58">
        <main className={`mx-auto flex min-h-dvh flex-col p-4 sm:p-6 lg:py-10 ${STUDENT_MEASURE}`}>
          {children}
        </main>
      </div>
    </>
  );
}

/** Exported for the test that holds the measures to DESIGN.md. */
export const MEASURES = { student: STUDENT_MEASURE, admin: ADMIN_MEASURE, unframed: UNFRAMED };
