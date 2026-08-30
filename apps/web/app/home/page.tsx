import { HomeScreen } from '../HomeScreen';

export const metadata = { title: 'Home' };

/**
 * The signed-in hub.
 *
 * It was the root route until 2026-08-20, when the public landing page took `/`.
 * The two audiences were always different — `HomeScreen`'s own docstring says a
 * visitor here is "a student with an exam coming, not a prospect to be
 * persuaded" — and serving one page to both meant a stranger's first sight of
 * the product was a hub of five destinations they could not open.
 */
export default function Home() {
  return <HomeScreen />;
}
