// User Story 3 acceptance scenario 2: pressing the render hotkey replays
// the most recent external clipboard content into the editor.

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
  userDataDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-hkr-'));
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify(ONBOARDED_SETTINGS));
  app = await electron.launch({
    args: [APP_ENTRY, `--user-data-dir=${userDataDir}`],
    timeout: 15_000,
  });
  page = await app.firstWindow({ timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#input', { state: 'attached', timeout: 5_000 });
});

test.afterEach(async () => {
  if (app) {
    try { await app.close(); } catch { /* ignore */ }
  }
  rmSync(userDataDir, { recursive: true, force: true });
});

test('render hotkey replays the most recent external Arabic content', async () => {
  // Seed an external Arabic copy
  await app.evaluate(({ clipboard }) => clipboard.writeText('السلام عليكم ورحمة الله'));
  await expect(page.locator('#input')).toHaveValue('السلام عليكم ورحمة الله', { timeout: 2_000 });

  // Wipe the editor
  await page.evaluate(() => {
    const i = document.getElementById('input') as HTMLTextAreaElement;
    const o = document.getElementById('output');
    i.value = '';
    if (o) o.innerHTML = '';
  });

  // Trigger render hotkey
  await app.evaluate(() => {
    const r = (globalThis as unknown as { __rtlfixer__: { hotkeyManager: { trigger: (a: string) => void } } }).__rtlfixer__;
    r.hotkeyManager.trigger('render');
  });

  await expect(page.locator('#input')).toHaveValue('السلام عليكم ورحمة الله', { timeout: 2_000 });
  await expect.poll(async () => page.evaluate(() => document.body.dataset.mode), { timeout: 1_000 }).toBe('expanded');
});
