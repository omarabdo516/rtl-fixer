// User Story 2 acceptance scenario 5: position persists across relaunch.

import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_ENTRY, DEFAULT_ONBOARDED_SETTINGS, type LaunchedApp } from './_helpers.js';

let env: LaunchedApp;
let userDataDir: string;

async function launchSeeded(opts: { writeSettings: boolean }): Promise<LaunchedApp> {
  if (opts.writeSettings) {
    writeFileSync(
      join(userDataDir, 'settings.json'),
      JSON.stringify(DEFAULT_ONBOARDED_SETTINGS),
    );
  }
  const app = await electron.launch({
    args: [APP_ENTRY, `--user-data-dir=${userDataDir}`],
    timeout: 15_000,
  });
  const page = await app.firstWindow({ timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#collapsed', { state: 'attached', timeout: 5_000 });
  return {
    app,
    page,
    userDataDir,
    async cleanup() {
      try { await app.close(); } catch { /* ignore */ }
    },
  };
}

test.beforeEach(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-pos-'));
});

test.afterEach(async () => {
  if (env) {
    await env.cleanup();
  }
  rmSync(userDataDir, { recursive: true, force: true });
});

test('drag-equivalent setPosition persists across relaunch', async () => {
  env = await launchSeeded({ writeSettings: true });

  const TARGET_X = 200;
  const TARGET_Y = 300;

  await env.page.evaluate(([x, y]) => window.api.widget.setPosition(x, y), [TARGET_X, TARGET_Y]);
  await env.page.waitForTimeout(400);

  await env.cleanup();
  // Don't overwrite the just-persisted settings.json on relaunch.
  env = await launchSeeded({ writeSettings: false });

  const bounds = await env.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBounds(),
  );
  expect(bounds?.x).toBe(TARGET_X);
  expect(bounds?.y).toBe(TARGET_Y);
});
