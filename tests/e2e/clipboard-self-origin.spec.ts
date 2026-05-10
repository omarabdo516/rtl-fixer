// E2E for User Story 1 acceptance scenario 3.

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

test('Copy Reply does not retrigger arabicDetected via the watcher', async () => {
  await env.page.evaluate(() => {
    (globalThis as unknown as { __arabicEventCount: number }).__arabicEventCount = 0;
    window.api.clipboard.onArabicDetected(() => {
      (globalThis as unknown as { __arabicEventCount: number }).__arabicEventCount++;
    });
  });

  const reply = 'تمام، هاكلم العميل بكره الصبح إن شاء الله';
  // #reply lives in the expanded section which is display:none in collapsed
  // mode; set the value via evaluate instead of page.fill which requires
  // visibility.
  await env.page.evaluate((text) => {
    const r = document.getElementById('reply') as HTMLTextAreaElement;
    r.value = text;
  }, reply);
  await env.page.evaluate((text) => window.api.clipboard.writeReply(text), reply);

  await env.page.waitForTimeout(1_400);

  const eventCount = await env.page.evaluate(
    () => (globalThis as unknown as { __arabicEventCount: number }).__arabicEventCount,
  );

  expect(eventCount).toBe(0);
});
