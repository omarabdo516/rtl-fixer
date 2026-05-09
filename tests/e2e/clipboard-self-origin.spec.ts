// E2E for User Story 1 acceptance scenario 3:
//   clicking Copy Reply (which writes to the OS clipboard via the main
//   process) MUST NOT trigger a recursive re-render in the editor — the
//   self-fingerprint cache should drop the next watcher tick.

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
  await page.waitForSelector('#input', { timeout: 5_000 });
});

test.afterEach(async () => {
  await app.close();
});

test('Copy Reply does not retrigger arabicDetected via the watcher', async () => {
  // Install a counter on the renderer's clipboard event subscription
  await page.evaluate(() => {
    (globalThis as unknown as { __arabicEventCount: number }).__arabicEventCount = 0;
    window.api.clipboard.onArabicDetected(() => {
      (globalThis as unknown as { __arabicEventCount: number }).__arabicEventCount++;
    });
  });

  // Type an Arabic reply and copy it via the typed API
  const reply = 'تمام، هاكلم العميل بكره الصبح إن شاء الله';
  await page.fill('#reply', reply);
  await page.evaluate((text) => window.api.clipboard.writeReply(text), reply);

  // Wait for at least 2 full poll cycles (~1.2s) so any recursive trigger
  // would have surfaced.
  await page.waitForTimeout(1_400);

  const eventCount = await page.evaluate(
    () => (globalThis as unknown as { __arabicEventCount: number }).__arabicEventCount,
  );

  // Self-originated clipboard write must be silently ignored.
  expect(eventCount).toBe(0);
});
