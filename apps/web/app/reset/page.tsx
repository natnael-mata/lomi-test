import { CodeFlow } from '../../components/CodeFlow';

export const metadata = { title: 'Reset your password · Lomi-Exams' };

/**
 * The door a locked-out student comes to.
 *
 * **This is the half that matters.** Phone-and-password makes lockout more
 * likely than the Telegram pairing it replaced, and until this existed a
 * student who forgot their password had no route back into an account they had
 * paid for.
 */
export default function ResetPage() {
  return <CodeFlow purpose="reset" />;
}
