import { StandingScreen } from './StandingScreen';

export const metadata = { title: 'Where you stand' };

export default function StandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <StandingScreen />
    </main>
  );
}
