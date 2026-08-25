import { CodeFlow } from '../../components/CodeFlow';

export const metadata = { title: 'Create your account · Lomi-Exams' };

/**
 * Signing up: a number, a code, a password.
 *
 * The same component as `/reset` — see `CodeFlow`. §12b of the design handoff
 * specifies them as one flow, and building them twice would be two sets of
 * limits and two sets of error states to keep in step.
 */
export default function SignUpPage() {
  return <CodeFlow purpose="register" />;
}
