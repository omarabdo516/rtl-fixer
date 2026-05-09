// User Story 2 acceptance scenario 5: dragging the widget then quitting and
// relaunching restores the saved position.
//
// We drive setPosition via IPC since the test harness can't deliver native
// OS-level mouse drags reliably. The IPC path is what production drag also
// uses (renderer pointer events → window.api.widget.setPosition).

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
  // Isolate settings.json per test
  userDataDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-pos-'));
});

test.afterEach(async () => {
  if (app) {
    try { await app.close(); } catch { /* ignore */ }
  }
  rmSync(userDataDir, { recursive: true, force: true });
});

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const a = await electron.launch({
    args: [APP_ENTRY, `--user-data-dir=${userDataDir}`],
    timeout: 15_000,
  });
  const p = await a.firstWindow({ timeout: 10_000 });
  await p.waitForLoadState('domcontentloaded');
  await p.waitForSelector('#collapsed', { timeout: 5_000 });
  return { app: a, page: p };
}

test('drag-equivalent setPosition persists across relaunch', async () => {
  ({ app, page } = await launch());

  const TARGET_X = 200;
  const TARGET_Y = 300;

  await page.evaluate(([x, y]) => window.api.widget.setPosition(x, y), [TARGET_X, TARGET_Y]);

  // Allow main process to debounce + persist (100ms debounce + write)
  await page.waitForTimeout(400);

  await app.close();

  ({ app, page } = await launch());

  const bounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBounds(),
  );
  // Allow snap-to-edge tolerance — but TARGET is far from any edge (>20px)
  expect(bounds?.x).toBe(TARGET_X);
  expect(bounds?.y).toBe(TARGET_Y);
});
