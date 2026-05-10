// Electron main entry point — Phase 5 (final user story).
// Wires every subsystem: settings, fingerprint cache, clipboard watcher,
// widget window with mode reactions, system tray, hotkey manager,
// autostart, and a lazy settings window.

import { app, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import { createSettingsStore } from './services/settingsStore.js';
import { createSelfFingerprintCache } from './services/selfFingerprintCache.js';
import { createClipboardWatcher } from './services/clipboardWatcher.js';
import { createWidgetWindow, type WidgetWindowControl } from './windows/widgetWindow.js';
import { createSettingsWindow } from './windows/settingsWindow.js';
import { createWidgetReactions } from './services/widgetReactions.js';
import { createTrayManager } from './services/trayManager.js';
import { createHotkeyManager } from './services/hotkeyManager.js';
import { createAutostartManager } from './services/autostart.js';
import { registerIpcHandlers } from './ipc/handlers.js';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let widget: WidgetWindowControl | null = null;
let settingsWin: BrowserWindow | null = null;

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
    const autostart = createAutostartManager();

    // Reconcile autostart with the actual registry value on launch.
    {
      const registryEnabled = autostart.isEnabled();
      const settingsEnabled = settingsStore.get().autostart;
      if (registryEnabled !== settingsEnabled) {
        settingsStore.set({ autostart: registryEnabled });
      }
    }

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

    // Sync renderer state on every page load (initial + Ctrl+R reload).
    // Without this, after a reload the renderer assumes mode='collapsed'
    // while the main process may still own an 'expanded' window — visually
    // broken (small bubble inside a big empty card).
    widget.window.webContents.on('did-finish-load', () => {
      if (!widget || widget.window.isDestroyed()) return;
      const w = widget.window.webContents;
      w.send(IPC.WIDGET_MODE_CHANGED, { mode: widget.getMode() });
      w.send(IPC.APP_ALWAYS_ON_TOP_CHANGED, { enabled: widget.isAlwaysOnTop() });
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

    const hotkeyManager = createHotkeyManager({
      bindings: settingsStore.get().hotkeys,
      onTriggered: (action) => {
        if (widget && !widget.window.isDestroyed()) {
          widget.window.webContents.send(IPC.HOTKEYS_TRIGGERED, { action });
        }
      },
      onConflict: (action) => {
        if (widget && !widget.window.isDestroyed()) {
          widget.window.webContents.send(IPC.HOTKEYS_CONFLICT, { action });
        }
        if (settingsWin && !settingsWin.isDestroyed()) {
          settingsWin.webContents.send(IPC.HOTKEYS_CONFLICT, { action });
        }
      },
    });

    hotkeyManager.registerAll();

    const showSettings = (): void => {
      if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.focus();
        return;
      }
      settingsWin = createSettingsWindow({
        ...(devServerUrl !== undefined ? { devServerUrl } : {}),
      });
      settingsWin.on('closed', () => {
        settingsWin = null;
      });
    };

    const tray = createTrayManager({ widget, onShowSettings: showSettings });

    registerIpcHandlers({
      settingsStore,
      clipboardWatcher,
      selfFingerprintCache,
      widget,
      hotkeyManager,
      autostart,
      showSettings,
      onOnboardingComplete: () => {
        widget?.swapToWidgetShell();
      },
    });

    clipboardWatcher.start();

    // Expose internals for E2E tests. Harmless in production but tests need
    // a way to call hotkeyManager.trigger() without OS-level keyboard input.
    (globalThis as unknown as { __rtlfixer__?: unknown }).__rtlfixer__ = {
      hotkeyManager,
      widget,
      autostart,
    };

    app.on('before-quit', () => {
      clipboardWatcher.stop();
      reactions.dispose();
      hotkeyManager.unregisterAll();
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
