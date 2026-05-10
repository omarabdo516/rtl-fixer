// E2E baseline test: launch the built Electron app, confirm a window
// appears with the typed window.api surface exposed, then quit cleanly.

import { test, expect } from '@playwright/test';
import { launchWithSettings, type LaunchedApp } from './_helpers.js';

let env: LaunchedApp;

test.beforeEach(async () => {
  env = await launchWithSettings();
});

test.afterEach(async () => {
  await env.cleanup();
});

test('app launches, window appears, window.api is exposed, app quits cleanly', async () => {
  expect(env.page).toBeTruthy();

  const apiAvailable = await env.page.evaluate(
    () => typeof (globalThis as { api?: unknown }).api === 'object' && (globalThis as { api?: unknown }).api !== null,
  );
  expect(apiAvailable).toBe(true);

  const hasPrefsGet = await env.page.evaluate(
    () => typeof (globalThis as { api?: { prefs?: { get?: unknown } } }).api?.prefs?.get === 'function',
  );
  expect(hasPrefsGet).toBe(true);
});
