import { DevLoginScreen } from './DevLoginScreen';

export const metadata = { title: 'Sign in for testing' };

/**
 * No `<main>` of its own: the shell renders one for unframed routes, and two
 * nested `main` landmarks is a page a screen reader reports as having two
 * documents in it.
 */
export default function DevLoginPage() {
  return <DevLoginScreen />;
}
