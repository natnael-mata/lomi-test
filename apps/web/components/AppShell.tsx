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
 * five take is the responsive question, answered in `Navigation.tsx`; what is
 * decided here is only how much room the furniture needs — a 240px sidebar from
 * `lg`, and 104px of clearance at the foot of a phone so the last control on
 * every screen is not underneath the tabs.
 */
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { AdminBar } from './AdminBar';
import { BottomBar, DESTINATIONS, SideRail, TopBar, isActive } from './Navigation';

/** Admin is permitted real tables and the room to show them. */
const ADMIN_MEASURE = 'max-w-[1200px]';
/** Student reading measure. 640px on desktop; the viewport on a phone. */
const STUDENT_MEASURE = 'max-w-[640px]';
/**
 * Student *data* measure (DESIGN.md § Layout, "a measure governs prose, not
 * figures").
 *
 * A measure holds running text near 65 characters. Readiness and standing carry
 * a headline figure, a weighted table and a trend — no running text at all — and
 * at 640px on a 1512px laptop they used 42% of the width and ran 1254px tall for
 * content that fits one screen. Measured before this change.
 *
 * 960 rather than the admin 1200: these still sit beside the 232px rail, and a
 * student is reading their own single result, not scanning a register.
 */
const DATA_MEASURE = 'max-w-[960px]';
/**
 * The screens whose content is figures rather than sentences.
 *
 * `/today` joined with the redesign: it is a countdown, a coverage meter, a
 * daily ring, weighted topic bars, mock bars and a week of dots — no running
 * text at all — and the handoff lays its cards on a 360px minimum, which at
 * 640px means one column of cards stacked down a laptop screen with the right
 * half of the window empty.
 */
const DATA_ROUTES = ['/today', '/progress', '/standing'];

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
const UNFRAMED = [
  '/design',
  '/dev-login',
  '/signin',
  /*
   * Sign-up and reset were NOT in this list, and should have been from the day
   * they were built.
   *
   * Both rendered inside the full student frame: a 240px sidebar listing Today,
   * Practice, Mocks, Progress and Account, plus a five-tab bottom bar, shown to
   * somebody who does not have an account yet or cannot get into the one they
   * have. Every one of those five is a sign-in wall. It is the exact mistake the
   * comment above describes, and `/signin` being in the list is what hid it —
   * the one auth screen anybody looks at was already correct.
   */
  '/signup',
  '/reset',
  '/dev-viewport',
];

/**
 * Routes that are unframed by EXACT match.
 *
 * `/` cannot go in the list above: that one is a prefix test, and every path in
 * the product starts with a slash — adding it there would strip the navigation
 * from every screen. The landing page is the only member and probably always
 * will be, which is why this is a set rather than a second prefix list.
 */
const UNFRAMED_EXACT = new Set(['/']);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';

  /*
    The public landing page: no rail, no bottom bar, and **no measure here**.

    It used to get `mx-auto max-w-[1080px] px-5` from this branch, like any other
    unframed screen. The redesign's landing alternates between light sections at
    a reading measure and full-bleed dark bands — the hero, the exam band, the
    footer — and a band capped at 1080px with page padding either side is a card,
    not a band. So this is the one route whose horizontal frame belongs to the
    screen rather than to the shell: see `LandingScreen`'s `MEASURE`.

    Showing a stranger five destinations they cannot open is still the mistake
    this branch exists to avoid, and that part is unchanged.
  */
  if (UNFRAMED_EXACT.has(pathname)) {
    return <main className="flex min-h-dvh flex-col">{children}</main>;
  }

  if (UNFRAMED.some((p) => pathname.startsWith(p))) {
    return <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col p-4">{children}</main>;
  }

  // `/provider` shares the admin frame: the same top bar, the same 1200px, and
  // the same person. A third layout for two screens would be a third thing to
  // keep in step with DESIGN.md.
  if (pathname.startsWith('/admin') || pathname.startsWith('/provider')) {
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
    /*
      Sidebar beside content from `lg`, stacked below it (handoff § App shell).
      
      A flex row rather than a grid: the sidebar is a fixed 240px and the main
      column takes what is left, which is one line of CSS in a row and three in
      a grid. `min-w-0` on the column because a flex child defaults to its
      content's width, and one unbroken question stem would otherwise widen the
      page rather than wrap.
    */
    <div className="flex min-h-dvh">
      <SideRail pathname={pathname} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={titleFor(pathname)} />
        <BottomBar pathname={pathname} />

        {/* 104px of bottom clearance below `lg`, for the 56px bar plus its
            safe area — the handoff's number, and it is what stops the last
            control on every screen sitting under the tabs. */}
        <div className="pb-26 lg:pb-0">
          <main
            className={`mx-auto flex w-full flex-col p-4 sm:p-6 lg:px-10 lg:py-8 ${
              DATA_ROUTES.some((p) => pathname.startsWith(p)) ? DATA_MEASURE : STUDENT_MEASURE
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * What the phone's top bar calls this screen.
 *
 * Derived from the route rather than passed down, because every page would
 * otherwise have to remember to declare it and the one that forgot would show
 * the previous screen's name. The fallback is the product, which is true of any
 * screen this does not know about.
 */
function titleFor(pathname: string): string {
  const named = DESTINATIONS.find((d) => isActive(pathname, d.href));
  if (named) return named.label;
  for (const [prefix, title] of Object.entries(OTHER_TITLES)) {
    if (pathname.startsWith(prefix)) return title;
  }
  return 'Lomi-Exams';
}

/** Screens outside the five destinations that still need a name up top. */
const OTHER_TITLES: Record<string, string> = {
  '/exam': 'Mock exam',
  '/checkout': 'Plans',
  '/community': 'Ask',
  '/standing': 'Standing',
  '/choose': 'Your programme',
};

/** Exported for the test that holds the measures to DESIGN.md. */
export const MEASURES = {
  /** Owned by `LandingScreen` now, per the branch above — stated, not applied. */
  landing: 'max-w-[1080px]',
  unframedExact: [...UNFRAMED_EXACT],
  student: STUDENT_MEASURE,
  admin: ADMIN_MEASURE,
  data: DATA_MEASURE,
  dataRoutes: DATA_ROUTES,
  unframed: UNFRAMED,
};
