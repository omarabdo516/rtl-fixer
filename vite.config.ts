import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  root: r('src/renderer'),
  base: './',
  build: {
    outDir: r('dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        widget: r('src/renderer/widget/index.html'),
        editor: r('src/renderer/editor/editor.html'),
        settings: r('src/renderer/settings/settings.html'),
        onboarding: r('src/renderer/onboarding/tour.html'),
      },
    },
    target: 'chrome120',
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@shared': r('src/shared'),
      '@renderer': r('src/renderer'),
    },
  },
});
