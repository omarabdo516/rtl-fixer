// User Story 3 autostart scenario: toggling autostart updates Windows'
// HKCU\...\Run via Electron's setLoginItemSettings; reading back via
// getLoginItemSettings reflects the new state.

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

const SETTINGS_AUTOSTART_OFF = {
  schemaVersion: 1,
  theme: 'system',
  layout: 'vertical',
  autostart: false,
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
  userDataDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-as-'));
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify(SETTINGS_AUTOSTART_OFF));
  app = await electron.launch({
    args: [APP_ENTRY, `--user-data-dir=${userDataDir}`],
    timeout: 15_000,
  });
  page = await app.firstWindow({ timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');
});

test.afterEach(async () => {
  // Always disable autostart at end of test to leave the registry clean
  if (app) {
    try {
      await app.evaluate(({ app: e }) => e.setLoginItemSettings({ openAtLogin: false }));
      await app.close();
    } catch { /* ignore */ }
  }
  rmSync(userDataDir, { recursive: true, force: true });
});

test('toggling autostart on then off reflects in getLoginItemSettings', async () => {
  // Enable
  const enabled = await page.evaluate(() => window.api.app.setAutostart(true));
  expect(enabled).toBe(true);

  let registry = await app.evaluate(({ app: e }) => e.getLoginItemSettings());
  expect(registry.openAtLogin).toBe(true);

  // Disable
  const disabled = await page.evaluate(() => window.api.app.setAutostart(false));
  expect(disabled).toBe(false);

  registry = await app.evaluate(({ app: e }) => e.getLoginItemSettings());
  expect(registry.openAtLogin).toBe(false);
});
