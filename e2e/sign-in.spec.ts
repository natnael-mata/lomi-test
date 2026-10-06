/**
 * The front door: the form a student actually types into.
 *
 * Different personas from the other journeys on purpose. A form sign in opens
 * a second session, and the device limit would evict the session another
 * journey is holding for the same account. And a different pair per screen
 * size, so each number signs in once a run and the limiter (five a number in
 * ten minutes) allows five runs back to back.
 */
import { expect, test } from '@playwright/test';

import { phoneFor, TEST_PASSWORD } from './testers';

const student = () => (test.info().project.name === 'phone' ? 'useri' : 'usere');
// Provider outranks admin and starts on the same console.
const staff = () => (test.info().project.name === 'phone' ? 'provider' : 'admin');

test('a student signs in with phone and password and lands on Today', async ({ page }) => {
  await page.goto('/signin');
  await page.getByLabel('Phone number').fill(phoneFor(student()));
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  // Enter, not a click: the form must submit the way a phone keyboard does.
  await page.locator('input[type="password"]').press('Enter');
  await expect(page).toHaveURL(/\/today$/);
});

test('a wrong password says so, and says nothing about whether the number exists', async ({
  page,
}) => {
  await page.goto('/signin');
  // A fresh number each run, held by no tester: a fixed one spent its own
  // allowance of five within a couple of runs and the message became the 429.
  const unknown = `0900${String(Date.now() % 1_000_000).padStart(6, '0')}`;
  await page.getByLabel('Phone number').fill(unknown);
  await page.locator('input[type="password"]').fill('not the password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByText('That phone number and password do not match an account.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signin$/);
});

test('staff land on the console, not on a student Today', async ({ page }) => {
  await page.goto('/signin');
  await page.getByLabel('Phone number').fill(phoneFor(staff()));
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
});

test('sign up says what a step is waiting for instead of greying the button', async ({ page }) => {
  await page.goto('/signup');
  const send = page.getByRole('button', { name: 'Send me a code' });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByText('Enter the whole number, like 0911 234 567.')).toBeVisible();
});
