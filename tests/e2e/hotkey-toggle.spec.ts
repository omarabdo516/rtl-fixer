// User Story 3 acceptance scenario 1: pressing the toggle hotkey from
// any application toggles the widget visibility.
//
// Implementation note: Playwright cannot reliably deliver OS-level keyboard
// shortcuts to globalShortcut targets. We validate two things:
//   (a) the accelerator was registered with the OS (globalShortcut.isRegistered)
//   (b) the action handler does the right thing when triggered (calling
//       hotkeyManager.trigger directly, exposed on globalThis for tests)

import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_ENTRY = join(__dirname, '../../dist/main/main.js');

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeEach(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-hotkey-'));
  // Mark onboarding completed so we land directly on the widget shell.
  writeFileSync(
    join(userDataDir, 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      theme: 'system',
      layout: 'vertical',
      autostart: true,
      onboardingCompleted: true,
      widget: { position: { x: -1, y: -1 }, pinnedEdge: null },
      hotkeys: {
        toggle: 'Control+Shift+R',
        render: 'Control+Shift+V',
        copyReply: 'Control+Shift+C',
        clear: 'Control+Shift+X',
      },
      sounds: { enabled: false, copyChime: true, notifyDing: true },
    }),
  );
  app = await electron.launch({
    args: [APP_ENTRY, `--user-data-dir=${userDataDir}`],
    timeout: 15_000,
  });
  page = await app.firstWindow({ timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#collapsed', { state: 'attached', timeout: 5_000 });
});

test.afterEach(async () => {
  if (app) {
    try { await app.close(); } catch { /* ignore */ }
  }
  rmSync(userDataDir, { recursive: true, force: true });
});

test('default toggle accelerator is registered with the OS', async () => {
  const isRegistered = await app.evaluate(({ globalShortcut }) =>
    globalShortcut.isRegistered('Control+Shift+R'),
  );
  expect(isRegistered).toBe(true);
});

test('triggering the toggle action expands then collapses the widget', async () => {
  // Initial mode
  await expect.poll(async () => page.evaluate(() => document.body.dataset.mode), { timeout: 1_000 }).toBe('collapsed');

  await app.evaluate(() => {
    const r = (globalThis as unknown as { __rtlfixer__: { hotkeyManager: { trigger: (a: string) => void } } }).__rtlfixer__;
    r.hotkeyManager.trigger('toggle');
  });

  await expect.poll(async () => page.evaluate(() => document.body.dataset.mode), { timeout: 1_000 }).toBe('expanded');

  await app.evaluate(() => {
    const r = (globalThis as unknown as { __rtlfixer__: { hotkeyManager: { trigger: (a: string) => void } } }).__rtlfixer__;
    r.hotkeyManager.trigger('toggle');
  });

  await expect.poll(async () => page.evaluate(() => document.body.dataset.mode), { timeout: 1_000 }).toBe('collapsed');
});
