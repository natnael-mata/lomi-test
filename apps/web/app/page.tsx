import { LandingScreen } from './LandingScreen';

export const metadata = {
  /*
   * `absolute`, so the root layout's `%s · Lomi-Exams` template does not append
   * the name to a title that already opens with it. This is the one page whose
   * title is the tagline rather than a section, and it is also the page most
   * likely to be shared as a link.
   */
  title: { absolute: 'Lomi-Exams. The shortcuts are closed, the questions are open' },
  description:
    'Practice for the Ethiopian national and university exit exams. Every answer explained: ' +
    'a one sentence idea, the worked solution, and why each wrong option tempted you.',
};

/**
 * The public front door. Static, no session lookup — see `LandingScreen`.
 * The signed-in hub moved to `/home`.
 */
export default function Landing() {
  return <LandingScreen />;
}
