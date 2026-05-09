// User Story 2 acceptance scenarios 1, 2, 3:
//   - widget stays on top across application switching (covered indirectly:
//     alwaysOnTop is true; native behavior is hard to assert in CI but the
//     window option is verifiable)
//   - clicking the collapsed circle transitions to expanded mode within ~250ms
//   - dragging changes window position (drag is exercised by widget-snap-edge
//     and widget-position-persist below)

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

test('widget starts in collapsed mode with 60x60 bounds and alwaysOnTop', async () => {
  const mode = await page.evaluate(() => document.body.dataset.mode);
  expect(mode).toBe('collapsed');

  const bounds = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return {
      bounds: win?.getBounds(),
      alwaysOnTop: win?.isAlwaysOnTop(),
    };
  });
  expect(bounds.bounds?.width).toBe(60);
  expect(bounds.bounds?.height).toBe(60);
  expect(bounds.alwaysOnTop).toBe(true);
});

test('clicking the collapsed bubble transitions to expanded mode', async () => {
  await page.click('#collapsed');

  // mode change broadcasts asynchronously over IPC; allow up to 1s
  await expect.poll(async () => page.evaluate(() => document.body.dataset.mode), {
    timeout: 1_000,
  }).toBe('expanded');

  // Window resized to expanded bounds
  const bounds = await app.evaluate(({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows()[0]?.getBounds();
  });
  expect(bounds?.width).toBe(720);
  expect(bounds?.height).toBe(600);
});

test('expanded mode collapse button returns to collapsed', async () => {
  await page.click('#collapsed');
  await expect.poll(async () => page.evaluate(() => document.body.dataset.mode), {
    timeout: 1_000,
  }).toBe('expanded');

  await page.click('#widget-collapse-btn');

  await expect.poll(async () => page.evaluate(() => document.body.dataset.mode), {
    timeout: 1_000,
  }).toBe('collapsed');

  const bounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBounds(),
  );
  expect(bounds?.width).toBe(60);
  expect(bounds?.height).toBe(60);
});
