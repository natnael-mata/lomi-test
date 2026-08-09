import { Dashboard } from './Dashboard';

export const metadata = { title: 'Overview · admin' };

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4">
      <Dashboard />
    </main>
  );
}
