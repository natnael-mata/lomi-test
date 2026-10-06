/**
 * Puts every tester account back into its promised state before a run.
 *
 * `dev:testers` is re-runnable and resets what journeys move (spent answers,
 * an open sitting, a claim, a changed display name). It refuses any database
 * that is not on this machine, so this can never touch a live one.
 */
import { execSync } from 'node:child_process';

export default function globalSetup(): void {
  if (process.env.E2E_SKIP_SEED === '1') return;
  execSync('npm run dev:testers -w api', { stdio: 'ignore' });
}
