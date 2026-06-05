import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

test('rejects unsupported file extensions with an inline alert', async ({ page }) => {
  const fixture = path.resolve(__dirname, 'tmp-invalid.pdf');
  fs.writeFileSync(fixture, 'not actually a contract');

  try {
    await page.goto('/');

    await page
      .getByRole('button', { name: /upload/i })
      .first()
      .click();

    await page.setInputFiles('input[type="file"]', fixture);

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('.txt or .md');
    await expect(alert).toContainText('.pdf');

    await expect(page).toHaveURL('http://localhost:4200/');
  } finally {
    fs.unlinkSync(fixture);
  }
});

test('rejects files over the 5 MB ceiling with a specific size in the error', async ({ page }) => {
  const fixture = path.resolve(__dirname, 'tmp-oversize.txt');
  fs.writeFileSync(fixture, Buffer.alloc(6 * 1024 * 1024, 'x'));

  try {
    await page.goto('/');

    await page
      .getByRole('button', { name: /upload/i })
      .first()
      .click();

    await page.setInputFiles('input[type="file"]', fixture);

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('under 5 MB');
    await expect(alert).toContainText('6.0 MB');

    await expect(page).toHaveURL('http://localhost:4200/');
  } finally {
    fs.unlinkSync(fixture);
  }
});
