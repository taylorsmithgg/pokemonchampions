import { test, expect } from '@playwright/test';

test('URL input accepts Twitch and YouTube', async ({ page }) => {
  await page.goto('/#/stream');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('input[placeholder*="channel"], input[placeholder*="Stream"]')).toBeVisible();
  await expect(page.locator('button:has-text("Watch")')).toBeVisible();
});
