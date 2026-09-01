import { redirect } from 'next/navigation';

/**
 * `/access` → `/checkout` (T-268).
 *
 * **The navigation calls this destination "Access" and the route is
 * `/checkout`.** That is deliberate — the screen is where a student pays, and
 * "Access" is what they are buying rather than what the page is — but it means
 * the obvious URL is a guess anybody would make, and typing it produced the
 * bare Next.js 404: no chrome, no lemon, no way back, on a product whose own
 * bottom bar had just used that word.
 *
 * A redirect rather than a second copy of the screen, so there is still exactly
 * one checkout and one thing to keep working.
 */
export default function Access(): never {
  redirect('/checkout');
}
