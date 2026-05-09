// User Story 2 acceptance scenario 4: after the cursor has been away from
// the collapsed widget for ~5s, opacity drops to ~0.3; bringing the cursor
// back restores it.
//
// We can't drive an OS-level mouse position consistently across CI hosts,
// so we simulate by dispatching mouseleave / mouseenter events directly.
// The widget's fade logic is documented to react to these DOM events.

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
  await page.waitForSelector('#collapsed', { timeout: 5_000 });
});

test.afterEach(async () => {
  await app.close();
});

test('mouse-out for 5s fades to is-faded; mouse-in restores', async () => {
  // Confirm not faded initially
  let faded = await page.evaluate(() => document.body.classList.contains('is-faded'));
  expect(faded).toBe(false);

  // Simulate mouse leaving the widget
  await page.evaluate(() => {
    document.body.dispatchEvent(new MouseEvent('mouseleave'));
  });

  // Fade kicks in after FADE_DELAY_MS (5000ms). Allow margin.
  await expect
    .poll(async () => page.evaluate(() => document.body.classList.contains('is-faded')), {
      timeout: 6_500,
    })
    .toBe(true);

  // Bring cursor back
  await page.evaluate(() => {
    document.body.dispatchEvent(new MouseEvent('mouseenter'));
  });

  faded = await page.evaluate(() => document.body.classList.contains('is-faded'));
  expect(faded).toBe(false);
});

test('expanded mode does not auto-fade', async () => {
  await page.click('#collapsed');
  await expect
    .poll(async () => page.evaluate(() => document.body.dataset.mode), { timeout: 1_000 })
    .toBe('expanded');

  await page.evaluate(() => {
    document.body.dispatchEvent(new MouseEvent('mouseleave'));
  });

  await page.waitForTimeout(5_500);
  const faded = await page.evaluate(() => document.body.classList.contains('is-faded'));
  expect(faded).toBe(false);
});
