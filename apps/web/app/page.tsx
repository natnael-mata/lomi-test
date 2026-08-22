import { LandingScreen } from './LandingScreen';

export const metadata = {
  title: 'Lomi-Exams — the shortcuts are closed, the questions are open',
  description:
    'Practice for the Ethiopian national and university exit exams. Every answer explained: ' +
    'a one-sentence idea, the worked solution, and why each wrong option tempted you.',
};

/**
 * The public front door. Static, no session lookup — see `LandingScreen`.
 * The signed-in hub moved to `/home`.
 */
export default function Landing() {
  return <LandingScreen />;
}
