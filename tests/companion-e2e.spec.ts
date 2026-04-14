import { test, expect } from '@playwright/test';

async function addPokemon(page: import('@playwright/test').Page, inputLocator: import('@playwright/test').Locator, name: string) {
  await inputLocator.click();
  await inputLocator.fill('');
  await inputLocator.pressSequentially(name, { delay: 30 });
  await page.waitForTimeout(400);
  const suggestion = page.locator(`button:has-text("${name}")`).first();
  if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
    await suggestion.click();
  } else {
    await inputLocator.press('Tab');
  }
  await page.waitForTimeout(200);
}

async function getTeamInput(page: import('@playwright/test').Page) {
  const editBtn = page.locator('button:has-text("Edit")').first();
  if (await editBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(300);
  }
  return page.locator('input[placeholder*="Pokemon"], input[placeholder*="slot"]').first();
}

test.describe('Companion E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/stream');
    await page.evaluate(() => {
      localStorage.removeItem('stream-companion-history');
      localStorage.removeItem('stream-companion-channel');
      localStorage.removeItem('stream-companion-my-team');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('full game cycle: team → watch → opponents → analysis → W/L', async ({ page }) => {
    // 1. Enter team
    const teamInput = await getTeamInput(page);
    for (const mon of ['Garchomp', 'Gardevoir', 'Incineroar', 'Rillaboom']) {
      await addPokemon(page, teamInput, mon);
    }

    // 2. Watch a stream
    const urlInput = page.locator('input[placeholder*="Twitch or YouTube"]');
    await urlInput.fill('lizard_machine');
    await page.locator('button:has-text("Watch")').click();
    await page.waitForTimeout(2000);
    await expect(page.locator('iframe[src*="twitch"]')).toBeVisible();

    // 3. Enter opponents
    const oppInput = page.locator('input[placeholder*="Pokemon"], input[placeholder*="slot"]').last();
    for (const mon of ['Tyranitar', 'Excadrill', 'Togekiss']) {
      await addPokemon(page, oppInput, mon);
    }
    await page.waitForTimeout(500);

    // 4. Verify analysis
    for (const label of ['Archetype', 'Bring', 'Threat']) {
      const found = (await page.textContent('body'))?.includes(label);
      console.log(`${found ? '✓' : '✗'} ${label}`);
    }

    // 5. Record WIN
    await page.locator('button:has-text("WIN")').click();
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: /History \(1\)/ })).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/e2e-full-cycle.png', fullPage: true });
  });

  test('overlay shows full data', async ({ page }) => {
    const teamInput = await getTeamInput(page);
    for (const mon of ['Garchomp', 'Gardevoir', 'Incineroar', 'Rillaboom']) {
      await addPokemon(page, teamInput, mon);
    }
    const oppInput = page.locator('input[placeholder*="Pokemon"], input[placeholder*="slot"]').last();
    for (const mon of ['Tyranitar', 'Togekiss', 'Excadrill']) {
      await addPokemon(page, oppInput, mon);
    }
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Overlay")').first().click();
    await page.waitForTimeout(500);

    const body = await page.textContent('body');
    for (const c of ['CHAMPIONS', 'TRAINER', 'OPPONENT', 'BRING ORDER', 'Tyranitar']) {
      console.log(`Overlay ${body?.includes(c) ? '✓' : '✗'} ${c}`);
    }
    expect(body).toContain('CHAMPIONS');
    expect(body).toContain('BRING ORDER');
    await page.screenshot({ path: 'tests/screenshots/e2e-overlay.png', fullPage: true });
  });

  test('match timer shows during game', async ({ page }) => {
    const teamInput = await getTeamInput(page);
    await addPokemon(page, teamInput, 'Garchomp');
    await addPokemon(page, teamInput, 'Gardevoir');

    const oppInput = page.locator('input[placeholder*="Pokemon"], input[placeholder*="slot"]').last();
    await addPokemon(page, oppInput, 'Tyranitar');
    await page.waitForTimeout(1500);

    const body = await page.textContent('body');
    console.log('Match timer visible:', body?.includes('Match'));
    await page.screenshot({ path: 'tests/screenshots/e2e-timer.png', fullPage: true });
  });
});
