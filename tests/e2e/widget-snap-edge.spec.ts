// User Story 2 acceptance scenario 6: snap-to-edge.

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

test('release within 20px of right edge snaps flush right', async () => {
  const target = await env.app.evaluate(({ screen }) => {
    const wa = screen.getPrimaryDisplay().workArea;
    return {
      x: wa.x + wa.width - 60 - 5,
      y: 200,
      flushX: wa.x + wa.width - 60,
    };
  });

  await env.page.evaluate(([x, y]) => window.api.widget.setPosition(x, y), [target.x, target.y]);
  await env.page.waitForTimeout(400);

  const bounds = await env.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBounds(),
  );
  expect(bounds?.x).toBe(target.flushX);
});

test('release more than 20px from any edge does NOT snap', async () => {
  const before = { x: 500, y: 500 };
  await env.page.evaluate(([x, y]) => window.api.widget.setPosition(x, y), [before.x, before.y]);
  await env.page.waitForTimeout(400);

  const bounds = await env.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getBounds(),
  );
  expect(bounds?.x).toBe(before.x);
  expect(bounds?.y).toBe(before.y);
});
