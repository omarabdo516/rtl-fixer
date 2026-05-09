import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

export default function globalSetup(): void {
  // Build main, preload, and renderer once before all e2e tests run. Keeps
  // each spec free of build orchestration and ensures dist/ is current.
  console.info('[e2e] Building app for tests...');
  execSync('pnpm build:main && pnpm build:preload && pnpm build:renderer', {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
  console.info('[e2e] Build complete.');
}
