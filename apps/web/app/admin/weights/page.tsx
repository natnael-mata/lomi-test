import { WeightEditor } from './WeightEditor';

export const metadata = { title: 'Topic weights · admin' };

export default function AdminWeightsPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4">
      <WeightEditor />
    </main>
  );
}
