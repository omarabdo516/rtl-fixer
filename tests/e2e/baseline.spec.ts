// E2E baseline test: launch the built Electron app, confirm a window appears
// with the typed window.api surface exposed, then quit cleanly. Validates that
// the foundational scaffolding (single-instance lock, IPC, preload bridge)
// holds together before any feature-level E2E tests are written.

import { test, expect, _electron as electron } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const APP_ENTRY = join(__dirname, '../../dist/main/main.js');

test('app launches, window appears, window.api is exposed, app quits cleanly', async () => {
  const electronApp = await electron.launch({
    args: [APP_ENTRY],
    timeout: 15_000,
  });

  const window = await electronApp.firstWindow({ timeout: 10_000 });
  expect(window).toBeTruthy();

  await window.waitForLoadState('domcontentloaded');

  // Confirm the preload script exposed window.api
  const apiAvailable = await window.evaluate(
    () => typeof (globalThis as { api?: unknown }).api === 'object' && (globalThis as { api?: unknown }).api !== null,
  );
  expect(apiAvailable).toBe(true);

  // Confirm a known method exists on the api surface (smoke test of the contract)
  const hasPrefsGet = await window.evaluate(
    () => typeof (globalThis as { api?: { prefs?: { get?: unknown } } }).api?.prefs?.get === 'function',
  );
  expect(hasPrefsGet).toBe(true);

  await electronApp.close();
});
