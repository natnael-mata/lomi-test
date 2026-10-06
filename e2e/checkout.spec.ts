/**
 * Checkout, without moving money: the page that asks for it must be honest
 * about which ways to pay are open.
 */
import { expect, test } from '@playwright/test';

import { signInAs } from './testers';

test('bank transfer cannot be claimed against an account nobody published', async ({
  context,
  page,
}) => {
  await signInAs(context, 'userd');
  await page.goto('/checkout');
  // The radio is visually hidden inside its card; a student taps the card.
  const bank = page.getByRole('radio', { name: /Bank transfer/ });
  await page.locator('label', { has: bank }).click();
  await expect(bank).toBeChecked();

  const notPublished = page.getByText(/the account to pay into has not been published/);
  if (await notPublished.isVisible()) {
    // No account in this build: nothing may be submitted.
    await expect(page.getByRole('button', { name: 'Submit for verification' })).toBeDisabled();
  } else {
    // An account is published: the reference is what the claim needs.
    await expect(page.getByLabel(/reference/i).first()).toBeVisible();
  }
});
