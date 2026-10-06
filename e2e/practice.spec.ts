/**
 * The core loop: a question, an answer, the verdict, the explanation.
 */
import { expect, test } from '@playwright/test';

import { signInAs } from './testers';

test('a subscribed student answers a question and reads the verdict', async ({ context, page }) => {
  await signInAs(context, 'userc');
  await page.goto('/practice');

  const options = page.getByRole('radio');
  await expect(options.first()).toBeVisible();
  await options.first().click();
  await expect(options.first()).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Check answer' }).click();
  const verdict = page.locator('[data-section="verdict"]');
  await expect(verdict).toBeVisible();
  // Right or wrong, the explanation is on screen without another tap.
  await expect(page.locator('[data-section="solution"]')).toBeVisible();
});

test('a student with every free question spent meets the plans', async ({ context, page }) => {
  await signInAs(context, 'userd');
  await page.goto('/practice');
  await expect(page.getByText(/You have used your ten free questions/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Get full access|See plans/ }).first()).toBeVisible();
});
