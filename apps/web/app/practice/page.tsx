import { PracticeScreen } from './PracticeScreen';

export const metadata = { title: 'Practice · Lomi-Test' };

export default function PracticePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <PracticeScreen />
    </main>
  );
}
