import { TodayScreen } from './TodayScreen';

export const metadata = { title: 'Today' };

/**
 * Today — the hub a signed-in student lands on (redesign step 6).
 *
 * It replaced `/home`, which redirects here so that a bookmark, a link in an
 * old SMS or a browser's autocomplete does not end at a 404. See `TodayScreen`.
 */
export default function TodayPage() {
  return <TodayScreen />;
}
