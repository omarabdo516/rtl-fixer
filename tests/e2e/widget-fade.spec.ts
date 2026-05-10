// User Story 2 acceptance scenario 4: auto-fade.

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

test('mouse-out for 5s fades to is-faded; mouse-in restores', async () => {
  let faded = await env.page.evaluate(() => document.body.classList.contains('is-faded'));
  expect(faded).toBe(false);

  await env.page.evaluate(() => {
    document.body.dispatchEvent(new MouseEvent('mouseleave'));
  });

  await expect
    .poll(async () => env.page.evaluate(() => document.body.classList.contains('is-faded')), {
      timeout: 6_500,
    })
    .toBe(true);

  await env.page.evaluate(() => {
    document.body.dispatchEvent(new MouseEvent('mouseenter'));
  });

  faded = await env.page.evaluate(() => document.body.classList.contains('is-faded'));
  expect(faded).toBe(false);
});

test('expanded mode does not auto-fade', async () => {
  await env.page.click('#collapsed');
  await expect
    .poll(async () => env.page.evaluate(() => document.body.dataset.mode), { timeout: 1_000 })
    .toBe('expanded');

  await env.page.evaluate(() => {
    document.body.dispatchEvent(new MouseEvent('mouseleave'));
  });

  await env.page.waitForTimeout(5_500);
  const faded = await env.page.evaluate(() => document.body.classList.contains('is-faded'));
  expect(faded).toBe(false);
});
