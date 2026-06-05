import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FIXTURE_TEXT =
  'Customer shall pay invoices within thirty days of receipt. ' +
  'Parties shall keep all information confidential and not disclose it to third parties.';

test('upload a contract, label the first sentence, see the label on the dashboard', async ({
  page,
}) => {
  const fixture = path.resolve(__dirname, 'tmp-contract.txt');
  fs.writeFileSync(fixture, FIXTURE_TEXT);

  try {
    await page.goto('/');

    await page.getByRole('button', { name: /upload/i }).first().click();
    await page.setInputFiles('input[type="file"]', fixture);

    await page.waitForURL(/\/documents\//, { timeout: 10_000 });

    const firstSentence = page
      .getByRole('button')
      .filter({ hasText: /Customer shall pay/ })
      .first();
    await expect(firstSentence).toBeVisible();
    await firstSentence.click();

    const search = page.getByPlaceholder('Search clause types…');
    await expect(search).toBeFocused();
    await search.fill('payment');
    await page.keyboard.press('Enter');

    await expect(firstSentence).toContainText('Payment Terms');

    await page.getByRole('link', { name: /contracts/i }).first().click();
    await expect(page).toHaveURL(/\/$|\/\?/);

    await expect(page.locator('table')).toContainText('Payment Terms');
  } finally {
    fs.unlinkSync(fixture);
  }
});
