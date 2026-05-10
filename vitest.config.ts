// R2-037: vitest unit tests run in pure node — no Electron, no built dist.
// Each test imports source modules directly (src/main/services/* and
// src/shared/*) and runs without needing `pnpm build:main` first. If a unit
// test ever needs `dist/` artifacts, it should move to tests/e2e/* instead.
// This is intentionally NOT in lockstep with the e2e suite, which DOES need
// the full Electron build to drive the app via @playwright/test.

import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/main/main.ts',
        'src/main/windows/**',
        'src/main/services/trayManager.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': r('src/shared'),
    },
  },
});
