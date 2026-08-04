import { ExamScreen } from './ExamScreen';

export const metadata = { title: 'Mock exam · Lomi-Test' };

export default function ExamPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <ExamScreen />
    </main>
  );
}
