/**
 * Account: the display name a student chooses for the board.
 */
import { expect, test } from '@playwright/test';

import { signInAs } from './testers';

test('a student renames themselves, and a refused name says why', async ({
  context,
  page,
}, info) => {
  await signInAs(context, 'userh');
  await page.goto('/account');

  const field = page.getByLabel('Display name');
  await expect(field).toBeVisible();

  await field.fill('Call me 0911234567');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(
    page.getByText(/Leave phone numbers and other long numbers out of it\./),
  ).toBeVisible();

  // A name per project, so the two runs do not depend on each other's state.
  const name = info.project.name === 'phone' ? 'Steady Phone Learner' : 'Steady Desk Learner';
  await field.fill(name);
  await field.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Saved. Other students see this name now.');

  await page.reload();
  await expect(page.getByLabel('Display name')).toHaveValue(name);
});
