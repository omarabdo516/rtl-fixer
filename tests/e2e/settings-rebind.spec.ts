// User Story 3 acceptance scenarios 5 + 6: rebinding a hotkey from the
// settings panel changes the registered shortcut. Conflict detection
// surfaces invalid combos.

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

const ONBOARDED_SETTINGS = {
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
};

test.beforeEach(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-rebind-'));
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify(ONBOARDED_SETTINGS));
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

test('setBinding to a fresh combo registers the new accelerator and unregisters the old', async () => {
  // Rebind toggle from R → T
  const result = await app.evaluate(({ globalShortcut }) => {
    const r = (globalThis as unknown as {
      __rtlfixer__: { hotkeyManager: { setBinding: (a: string, acc: string) => unknown } };
    }).__rtlfixer__;
    const setResult = r.hotkeyManager.setBinding('toggle', 'Control+Shift+T');
    return {
      setResult,
      newRegistered: globalShortcut.isRegistered('Control+Shift+T'),
      oldRegistered: globalShortcut.isRegistered('Control+Shift+R'),
    };
  });

  expect(result.setResult).toEqual({ ok: true });
  expect(result.newRegistered).toBe(true);
  expect(result.oldRegistered).toBe(false);
});

test('setBinding rejects a combo that duplicates another action', async () => {
  // Try to set toggle to render's accelerator
  const result = await app.evaluate(() => {
    const r = (globalThis as unknown as {
      __rtlfixer__: { hotkeyManager: { setBinding: (a: string, acc: string) => unknown } };
    }).__rtlfixer__;
    return r.hotkeyManager.setBinding('toggle', 'Control+Shift+V');
  });
  expect(result).toEqual({ ok: false, reason: 'duplicate' });
});

test('setBinding rejects an invalid accelerator (no modifier)', async () => {
  const result = await app.evaluate(() => {
    const r = (globalThis as unknown as {
      __rtlfixer__: { hotkeyManager: { setBinding: (a: string, acc: string) => unknown } };
    }).__rtlfixer__;
    return r.hotkeyManager.setBinding('toggle', 'X');
  });
  expect(result).toEqual({ ok: false, reason: 'invalid-accelerator' });
});
