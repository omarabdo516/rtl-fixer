// E2E for User Story 1 edge case: rapid successive copies.

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

test('rapid Arabic clipboard changes settle on the most recent value', async () => {
  const samples = [
    'أهلاً يا فندم',
    'الـ workflow بتاع Claude متلخبط',
    'محتاج حد يساعدنا',
    'خلصنا الـ Phase 1 الحمد لله',
    'بكره نكمل Phase 2',
  ];

  for (const text of samples) {
    await env.app.evaluate(({ clipboard }, t) => clipboard.writeText(t), text);
    await env.page.waitForTimeout(120);
  }

  await expect(env.page.locator('#input')).toHaveValue(samples[samples.length - 1] ?? '', {
    timeout: 2_000,
  });

  const inputValue = await env.page.locator('#input').inputValue();
  expect(inputValue).toBe(samples[samples.length - 1]);
});
