/**
 * Progress: the five week activity grid, counted by the server.
 */
import { expect, test } from '@playwright/test';

import { signInAs } from './testers';

test('the activity grid is drawn and counts what was answered', async ({ context, page }) => {
  await signInAs(context, 'userc');
  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'Last 5 weeks' })).toBeVisible();

  // Every past day is an image with its own words: "Oct 6: 12 answered".
  const days = page.getByRole('img', { name: /^[A-Z][a-z]{2} \d{1,2}: / });
  // 29 to 35 of them, depending on the weekday (the rest of this week is to come).
  expect(await days.count()).toBeGreaterThanOrEqual(29);
  // User C has answered questions, so at least one day says so.
  await expect(page.getByRole('img', { name: /: \d+ answered$/ }).first()).toBeVisible();
});
