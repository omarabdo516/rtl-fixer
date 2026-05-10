// E2E for User Story 1 acceptance scenarios 1, 2, and 4.

import { test, expect } from '@playwright/test';
import { launchWithSettings, type LaunchedApp } from './_helpers.js';

let env: LaunchedApp;

test.beforeEach(async () => {
  env = await launchWithSettings();
  await env.page.waitForSelector('#input', { state: 'attached', timeout: 5_000 });
});

test.afterEach(async () => {
  await env.cleanup();
});

async function writeClipboard(text: string): Promise<void> {
  await env.app.evaluate(({ clipboard }, t) => {
    clipboard.writeText(t);
  }, text);
}

test('external Arabic copy populates the editor input within 1s', async () => {
  const arabicText = 'السلام عليكم ورحمة الله';
  await writeClipboard(arabicText);

  await expect(env.page.locator('#input')).toHaveValue(arabicText, { timeout: 2_000 });
  await expect(env.page.locator('#output')).toContainText('السلام عليكم');
});

test('subsequent external Arabic copy replaces previous content', async () => {
  await writeClipboard('أول رسالة من Claude');
  await expect(env.page.locator('#input')).toHaveValue('أول رسالة من Claude', { timeout: 2_000 });

  await writeClipboard('رسالة تانية مختلفة تماماً');
  await expect(env.page.locator('#input')).toHaveValue('رسالة تانية مختلفة تماماً', { timeout: 2_000 });
});

test('non-Arabic clipboard content is ignored by the watcher', async () => {
  const initialValue = await env.page.locator('#input').inputValue();
  await writeClipboard('Just plain English text — nothing Arabic in here.');

  await env.page.waitForTimeout(800);

  await expect(env.page.locator('#input')).toHaveValue(initialValue);
});
