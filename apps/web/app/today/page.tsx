import { redirect } from 'next/navigation';

/**
 * Today — the hub (redesign step 6).
 *
 * A redirect until that step builds it. The navigation names five destinations
 * and this is the first of them, so it has to go *somewhere* real from the
 * moment the bar ships: a tab that 404s is worse than a tab that is honest
 * about being the old screen for a few commits.
 */
export default function TodayPage(): never {
  redirect('/home');
}
