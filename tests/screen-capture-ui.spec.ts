import { test, expect } from '@playwright/test';

test('start detection button visible', async ({ page }) => {
  await page.goto('/#/stream');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button:has-text("Share Screen"), button:has-text("Start Detection")')).toBeVisible();
});
