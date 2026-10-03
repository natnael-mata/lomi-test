import { redirect } from 'next/navigation';

/**
 * The old hub's address, kept as a redirect to Today.
 *
 * `/home` was where every sign-in landed for two months. Dropping the route
 * outright would send each of those bookmarks, autocompletes and old links to
 * a 404 — the "dropping a destination must not orphan its route" rule, applied
 * to an address rather than a tab.
 */
export default function Home(): never {
  redirect('/today');
}
