import { ProgressScreen } from './ProgressScreen';

export const metadata = { title: 'Progress' };

export default function ProgressPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <ProgressScreen />
    </main>
  );
}
