import { redirect } from 'next/navigation';

/**
 * Mocks — the list of papers (redesign step 8).
 *
 * A redirect to the existing exam screen until that step. See `today/page.tsx`
 * for why these are redirects rather than placeholders.
 */
export default function MocksPage(): never {
  redirect('/exam');
}
