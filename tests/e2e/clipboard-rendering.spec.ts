// E2E for User Story 1 acceptance scenarios 1, 2, and 4:
//   - external Arabic copy reaches the editor within ~1s
//   - subsequent external copy replaces the previous content
//   - non-Arabic clipboard content is ignored

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
  // Wait for editor.ts to finish initial render so #input exists
  await page.waitForSelector('#input', { state: 'attached', timeout: 5_000 });
});

test.afterEach(async () => {
  await app.close();
});

async function writeClipboard(text: string): Promise<void> {
  await app.evaluate(({ clipboard }, t) => {
    clipboard.writeText(t);
  }, text);
}

test('external Arabic copy populates the editor input within 1s', async () => {
  const arabicText = 'السلام عليكم ورحمة الله';
  await writeClipboard(arabicText);

  // Polling watcher runs every 500ms; allow up to 2s for safety.
  await expect(page.locator('#input')).toHaveValue(arabicText, { timeout: 2_000 });
  await expect(page.locator('#output')).toContainText('السلام عليكم');
});

test('subsequent external Arabic copy replaces previous content', async () => {
  await writeClipboard('أول رسالة من Claude');
  await expect(page.locator('#input')).toHaveValue('أول رسالة من Claude', { timeout: 2_000 });

  await writeClipboard('رسالة تانية مختلفة تماماً');
  await expect(page.locator('#input')).toHaveValue('رسالة تانية مختلفة تماماً', { timeout: 2_000 });
});

test('non-Arabic clipboard content is ignored by the watcher', async () => {
  // Seed an empty editor and verify it stays empty even with English clipboard
  const initialValue = await page.locator('#input').inputValue();
  await writeClipboard('Just plain English text — nothing Arabic in here.');

  // Wait one full poll cycle plus margin
  await page.waitForTimeout(800);

  await expect(page.locator('#input')).toHaveValue(initialValue);
});
