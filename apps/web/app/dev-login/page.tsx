import { DevLoginScreen } from './DevLoginScreen';

export const metadata = { title: 'Sign in for testing' };

export default function DevLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <DevLoginScreen />
    </main>
  );
}
