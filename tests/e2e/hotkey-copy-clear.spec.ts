// User Story 3 acceptance scenarios 3 + 4: copy-reply and clear hotkeys.

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
    render: 'Control+Alt+V',
    copyReply: 'Control+Shift+C',
    clear: 'Control+Shift+X',
  },
  sounds: { enabled: false, copyChime: true, notifyDing: true },
};

test.beforeEach(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-hkcc-'));
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

test('copyReply hotkey writes the reply textarea contents to the OS clipboard', async () => {
  const reply = 'تمام يا فندم، هاتواصل معاك بكره';
  await page.evaluate((t) => {
    const r = document.getElementById('reply') as HTMLTextAreaElement;
    r.value = t;
  }, reply);

  await app.evaluate(() => {
    const r = (globalThis as unknown as { __rtlfixer__: { hotkeyManager: { trigger: (a: string) => void } } }).__rtlfixer__;
    r.hotkeyManager.trigger('copyReply');
  });

  // Allow the IPC round-trip + clipboard write to settle.
  await page.waitForTimeout(150);

  const clipboardValue = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(clipboardValue).toBe(reply);
});

test('clear hotkey empties input, output, and reply in a single action', async () => {
  await page.evaluate(() => {
    (document.getElementById('input') as HTMLTextAreaElement).value = 'something';
    const o = document.getElementById('output');
    if (o) o.innerHTML = '<p>rendered</p>';
    (document.getElementById('reply') as HTMLTextAreaElement).value = 'reply text';
  });

  await app.evaluate(() => {
    const r = (globalThis as unknown as { __rtlfixer__: { hotkeyManager: { trigger: (a: string) => void } } }).__rtlfixer__;
    r.hotkeyManager.trigger('clear');
  });

  await expect(page.locator('#input')).toHaveValue('');
  await expect(page.locator('#reply')).toHaveValue('');
  const outputHtml = await page.evaluate(() => document.getElementById('output')?.innerHTML);
  expect(outputHtml).toBe('');
});
