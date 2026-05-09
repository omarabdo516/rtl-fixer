// E2E for User Story 1 edge case: rapid successive copies should result
// in the editor reflecting only the most recent content (no flicker, no
// queueing artifacts).

import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_ENTRY = join(__dirname, '../../dist/main/main.js');

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await electron.launch({ args: [APP_ENTRY], timeout: 15_000 });
  page = await app.firstWindow({ timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#input', { state: 'attached', timeout: 5_000 });
});

test.afterEach(async () => {
  await app.close();
});

test('rapid Arabic clipboard changes settle on the most recent value', async () => {
  const samples = [
    'أهلاً يا فندم',
    'الـ workflow بتاع Claude متلخبط',
    'محتاج حد يساعدنا',
    'خلصنا الـ Phase 1 الحمد لله',
    'بكره نكمل Phase 2',
  ];

  for (const text of samples) {
    await app.evaluate(({ clipboard }, t) => clipboard.writeText(t), text);
    await page.waitForTimeout(120); // faster than the 500ms poll
  }

  // Settle: wait for at least one poll cycle after the last write.
  await expect(page.locator('#input')).toHaveValue(samples[samples.length - 1] ?? '', {
    timeout: 2_000,
  });

  const inputValue = await page.locator('#input').inputValue();
  expect(inputValue).toBe(samples[samples.length - 1]);
});
