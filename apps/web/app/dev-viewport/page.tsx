import { Suspense } from 'react';

import { notFound } from 'next/navigation';

import { DevViewport } from './DevViewport';

export const metadata = { title: 'Viewport harness' };

/**
 * A testing harness, and it does not ship (T-269).
 *
 * It exists only so a browser-driving tester can measure the app at a width
 * their tooling refuses to set, and a page that frames arbitrary same-origin
 * paths has no business on a public build. (`/dev-login`, the tester sign-in
 * page, was removed outright before the first redesigned deploy.)
 *
 * `NODE_ENV` rather than a flag, so nobody has to remember to set anything.
 */
export default function DevViewportPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  // `useSearchParams` needs a boundary, and the harness reads the whole of its
  // state from the query.
  return (
    <Suspense fallback={null}>
      <DevViewport />
    </Suspense>
  );
}
