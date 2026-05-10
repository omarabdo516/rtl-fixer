// User Story 2 acceptance scenarios 1, 2, 3.

import { test, expect } from '@playwright/test';
import { launchWithSettings, type LaunchedApp } from './_helpers.js';

let env: LaunchedApp;

test.beforeEach(async () => {
  env = await launchWithSettings();
  await env.page.waitForSelector('#collapsed', { state: 'attached', timeout: 5_000 });
});

test.afterEach(async () => {
  await env.cleanup();
});

test('widget starts in collapsed mode with 60x60 bounds and alwaysOnTop', async () => {
  const mode = await env.page.evaluate(() => document.body.dataset.mode);
  expect(mode).toBe('collapsed');

  const bounds = await env.app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return {
      bounds: win?.getBounds(),
      alwaysOnTop: win?.isAlwaysOnTop(),
    };
  });
  expect(bounds.bounds?.width).toBe(60);
  expect(bounds.bounds?.height).toBe(60);
  expect(bounds.alwaysOnTop).toBe(true);
});

test('clicking the collapsed bubble transitions to expanded mode', async () => {
  await env.page.click('#collapsed');

  await expect.poll(async () => env.page.evaluate(() => document.body.dataset.mode), {
    timeout: 1_000,
  }).toBe('expanded');

  const bounds = await env.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBounds(),
  );
  expect(bounds?.width).toBe(720);
  expect(bounds?.height).toBe(600);
});

test('expanded mode collapse button returns to collapsed', async () => {
  await env.page.click('#collapsed');
  await expect.poll(async () => env.page.evaluate(() => document.body.dataset.mode), {
    timeout: 1_000,
  }).toBe('expanded');

  await env.page.click('#widget-collapse-btn');

  await expect.poll(async () => env.page.evaluate(() => document.body.dataset.mode), {
    timeout: 1_000,
  }).toBe('collapsed');

  const bounds = await env.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBounds(),
  );
  expect(bounds?.width).toBe(60);
  expect(bounds?.height).toBe(60);
});
