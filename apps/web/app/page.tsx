import { HomeScreen } from './HomeScreen';

export const metadata = { title: 'Lomi-Test' };

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <HomeScreen />
    </main>
  );
}
