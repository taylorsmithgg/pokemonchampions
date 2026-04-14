import { test, expect } from '@playwright/test';

test('URL input accepts Twitch and YouTube', async ({ page }) => {
  await page.goto('/#/stream');
  await page.waitForLoadState('networkidle');

  const urlInput = page.locator('input[placeholder*="Twitch or YouTube"]');
  await expect(urlInput).toBeVisible();
  await expect(page.locator('button:has-text("Watch")')).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/url-input.png', fullPage: true });
});
