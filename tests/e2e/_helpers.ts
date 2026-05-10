// E2E test helpers: launch the app with seeded settings + isolated
// userData directory so tests are deterministic across runs.

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserPreferences } from '../../src/shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const APP_ENTRY = join(__dirname, '../../dist/main/main.js');

export const DEFAULT_ONBOARDED_SETTINGS: UserPreferences = {
  schemaVersion: 1,
  theme: 'system',
  layout: 'vertical',
  autostart: false,
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

export interface LaunchOptions {
  settings?: Partial<UserPreferences>;
}

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
  cleanup: () => Promise<void>;
}

export async function launchWithSettings(opts: LaunchOptions = {}): Promise<LaunchedApp> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-e2e-'));
  const merged = { ...DEFAULT_ONBOARDED_SETTINGS, ...opts.settings };
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify(merged));

  const app = await electron.launch({
    args: [APP_ENTRY, `--user-data-dir=${userDataDir}`],
    timeout: 15_000,
  });
  const page = await app.firstWindow({ timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');

  return {
    app,
    page,
    userDataDir,
    async cleanup(): Promise<void> {
      try { await app.close(); } catch { /* ignore */ }
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}
