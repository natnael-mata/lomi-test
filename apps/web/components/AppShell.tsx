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
 * destinations, a bottom bar on phones and a left rail from `sm` up, and no page
 * gets to opt out or disagree.
 */
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { BottomBar, SideRail } from './Navigation';

/** Admin is permitted real tables and the room to show them. */
const ADMIN_MEASURE = 'max-w-[1200px]';
/** Student reading measure. 640px on desktop; the viewport on a phone. */
const STUDENT_MEASURE = 'max-w-[640px]';

/**
 * Screens that are deliberately outside the frame.
 *
 * The design gallery is a specimen sheet, not a student screen, and the
 * testing sign-in exists to get *into* the product — wrapping either in the
 * product's own navigation would be a lie about where somebody is.
 */
const UNFRAMED = ['/design', '/dev-login'];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';

  if (UNFRAMED.some((p) => pathname.startsWith(p))) {
    return <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col p-4">{children}</main>;
  }

  const isAdmin = pathname.startsWith('/admin');

  return (
    <>
      <SideRail pathname={pathname} />
      <BottomBar pathname={pathname} />

      {/*
        Room for the furniture: the rail takes 224px from `sm` up, and the
        bottom bar needs clearance on a phone or the last control on every
        screen sits underneath it.
      */}
      <div className="pb-24 sm:pb-0 sm:pl-56">
        <main
          className={[
            'mx-auto flex min-h-dvh flex-col p-4',
            isAdmin ? ADMIN_MEASURE : STUDENT_MEASURE,
          ].join(' ')}
        >
          {children}
        </main>
      </div>
    </>
  );
}

/** Exported for the test that holds the measures to DESIGN.md. */
export const MEASURES = { student: STUDENT_MEASURE, admin: ADMIN_MEASURE, unframed: UNFRAMED };
