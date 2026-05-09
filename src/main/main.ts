// Electron main entry point.
// Phase 4 wiring adds widget mode reactions, tray icon, and widget IPC
// handlers on top of Phase 3's clipboard MVP.

import { app } from 'electron';
import { createSettingsStore } from './services/settingsStore.js';
import { createSelfFingerprintCache } from './services/selfFingerprintCache.js';
import { createClipboardWatcher } from './services/clipboardWatcher.js';
import { createWidgetWindow, type WidgetWindowControl } from './windows/widgetWindow.js';
import { createWidgetReactions } from './services/widgetReactions.js';
import { createTrayManager } from './services/trayManager.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { IPC } from '../shared/ipc-channels.js';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let widget: WidgetWindowControl | null = null;

app.on('second-instance', () => {
  if (widget && !widget.window.isDestroyed()) {
    if (widget.window.isMinimized()) widget.window.restore();
    widget.window.focus();
    widget.setMode('expanded');
  }
});

app
  .whenReady()
  .then(() => {
    const settingsStore = createSettingsStore();
    const selfFingerprintCache = createSelfFingerprintCache();

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    widget = createWidgetWindow({
      settingsStore,
      ...(devServerUrl !== undefined ? { devServerUrl } : {}),
      onModeChanged: (mode) => {
        if (widget && !widget.window.isDestroyed()) {
          widget.window.webContents.send(IPC.WIDGET_MODE_CHANGED, { mode });
        }
      },
    });

    const reactions = createWidgetReactions({ widget });
    reactions.setPendingNotificationListener((hasPending) => {
      if (widget && !widget.window.isDestroyed()) {
        widget.window.webContents.send(IPC.WIDGET_PENDING_NOTIFICATION, { hasPending });
      }
    });

    const clipboardWatcher = createClipboardWatcher({
      selfFingerprintCache,
      onArabicDetected: (event) => {
        if (widget && !widget.window.isDestroyed()) {
          widget.window.webContents.send(IPC.CLIPBOARD_ARABIC_DETECTED, event);
        }
        reactions.handleClipboardArabic(event);
      },
    });

    const tray = createTrayManager({ widget });

    registerIpcHandlers({
      settingsStore,
      clipboardWatcher,
      selfFingerprintCache,
      widget,
    });

    clipboardWatcher.start();

    app.on('before-quit', () => {
      clipboardWatcher.stop();
      reactions.dispose();
      tray.destroy();
    });

    widget.window.on('closed', () => {
      widget = null;
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
