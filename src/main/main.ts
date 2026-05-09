// Electron main entry point. Phase 3 MVP wiring:
//   1. Single-instance lock
//   2. Settings store
//   3. Self-fingerprint cache (shared between watcher and IPC handlers)
//   4. Clipboard watcher (broadcasts arabicDetected to the widget)
//   5. Widget window loading the migrated v1 editor
//   6. IPC handlers (prefs:* + clipboard:*)

import { app, type BrowserWindow } from 'electron';
import { createSettingsStore } from './services/settingsStore.js';
import { createSelfFingerprintCache } from './services/selfFingerprintCache.js';
import { createClipboardWatcher } from './services/clipboardWatcher.js';
import { createWidgetWindow } from './windows/widgetWindow.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { IPC } from '../shared/ipc-channels.js';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let widgetWindow: BrowserWindow | null = null;

app.on('second-instance', () => {
  if (widgetWindow) {
    if (widgetWindow.isMinimized()) widgetWindow.restore();
    widgetWindow.focus();
  }
});

app
  .whenReady()
  .then(() => {
    const settingsStore = createSettingsStore();
    const selfFingerprintCache = createSelfFingerprintCache();

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    widgetWindow = devServerUrl
      ? createWidgetWindow({ devServerUrl })
      : createWidgetWindow();

    widgetWindow.on('closed', () => {
      widgetWindow = null;
    });

    const clipboardWatcher = createClipboardWatcher({
      selfFingerprintCache,
      onArabicDetected: (event) => {
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send(IPC.CLIPBOARD_ARABIC_DETECTED, event);
        }
      },
    });

    registerIpcHandlers({
      settingsStore,
      clipboardWatcher,
      selfFingerprintCache,
    });

    clipboardWatcher.start();

    app.on('before-quit', () => {
      clipboardWatcher.stop();
    });
  })
  .catch((err: unknown) => {
    console.error('[rtl-fixer-v2] Fatal startup error:', err);
    app.exit(1);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
