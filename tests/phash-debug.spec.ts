import { test } from '@playwright/test';

test('verify pHash DB loads and can match', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/#/stream');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Check if hash DB loaded by evaluating in page context
  const result = await page.evaluate(async () => {
    // Try to access the hash module
    try {
      const mod = await import('/src/utils/perceptualHash.ts');
      const ready = mod.isHashDBReady();
      const progress = mod.getHashLoadProgress();
      return { ready, progress, error: null };
    } catch (e: any) {
      return { ready: false, progress: 0, error: e.message };
    }
  });

  console.log('Hash DB ready:', result.ready);
  console.log('Hash DB progress:', result.progress);
  if (result.error) console.log('Error:', result.error);
  console.log('Console errors:', errors.length);
  errors.slice(0, 5).forEach(e => console.log('  ', e.slice(0, 200)));
});
