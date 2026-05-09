// User Story 2 acceptance scenario 6: dragging within 20px of a screen edge
// snaps the widget flush to that edge.

import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_ENTRY = join(__dirname, '../../dist/main/main.js');

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeEach(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-snap-'));
  app = await electron.launch({
    args: [APP_ENTRY, `--user-data-dir=${userDataDir}`],
    timeout: 15_000,
  });
  page = await app.firstWindow({ timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#collapsed', { timeout: 5_000 });
});

test.afterEach(async () => {
  if (app) {
    try { await app.close(); } catch { /* ignore */ }
  }
  rmSync(userDataDir, { recursive: true, force: true });
});

test('release within 20px of right edge snaps flush right', async () => {
  // Compute the right-edge target using the actual primary work area
  const target = await app.evaluate(({ screen }) => {
    const wa = screen.getPrimaryDisplay().workArea;
    return {
      // 5px inside the right edge → should snap flush (x = wa.x + wa.width - 60)
      x: wa.x + wa.width - 60 - 5,
      y: 200,
      flushX: wa.x + wa.width - 60,
    };
  });

  await page.evaluate(([x, y]) => window.api.widget.setPosition(x, y), [target.x, target.y]);
  // Wait for debounce + snap apply
  await page.waitForTimeout(400);

  const bounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBounds(),
  );
  expect(bounds?.x).toBe(target.flushX);
});

test('release more than 20px from any edge does NOT snap', async () => {
  const before = { x: 500, y: 500 };
  await page.evaluate(([x, y]) => window.api.widget.setPosition(x, y), [before.x, before.y]);
  await page.waitForTimeout(400);

  const bounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBounds(),
  );
  expect(bounds?.x).toBe(before.x);
  expect(bounds?.y).toBe(before.y);
});
