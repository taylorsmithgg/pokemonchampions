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

test.describe('Stream Companion', () => {
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

  test('page loads with team inputs + start button', async ({ page }) => {
    await expect(page.getByText('Your Team').first()).toBeVisible();
    await expect(page.getByText('Opponent').first()).toBeVisible();
    await expect(page.locator('button:has-text("Share Screen"), button:has-text("Start Detection")')).toBeVisible();
  });

  test('full analysis flow', async ({ page }) => {
    const teamInput = await getTeamInput(page);
    for (const mon of ['Garchomp', 'Gardevoir', 'Incineroar', 'Rillaboom']) {
      await addPokemon(page, teamInput, mon);
    }
    const oppInput = page.locator('input[placeholder*="Pokemon"], input[placeholder*="slot"]').last();
    for (const mon of ['Tyranitar', 'Excadrill', 'Togekiss']) {
      await addPokemon(page, oppInput, mon);
    }
    await page.waitForTimeout(500);
    const body = await page.textContent('body');
    expect(body).toContain('Archetype');
  });

  test('W/L + history', async ({ page }) => {
    const teamInput = await getTeamInput(page);
    await addPokemon(page, teamInput, 'Garchomp');
    await addPokemon(page, teamInput, 'Gardevoir');
    const oppInput = page.locator('input[placeholder*="Pokemon"], input[placeholder*="slot"]').last();
    await addPokemon(page, oppInput, 'Tyranitar');
    await page.waitForTimeout(300);
    await page.locator('button:has-text("WIN")').click();
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: /History \(1\)/ })).toBeVisible();
  });

  test('OBS overlay mode', async ({ page }) => {
    await page.locator('button:has-text("Overlay")').first().click();
    await page.waitForTimeout(500);
    const body = await page.textContent('body');
    expect(body).toContain('CHAMPIONS');
    expect(body).toContain('TRAINER');
    expect(body).toContain('OPPONENT');
  });

  test('team persists across reload', async ({ page }) => {
    const teamInput = await getTeamInput(page);
    await addPokemon(page, teamInput, 'Garchomp');
    await addPokemon(page, teamInput, 'Gardevoir');
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const body = await page.textContent('body');
    expect(body).toContain('Garchomp');
  });
});
