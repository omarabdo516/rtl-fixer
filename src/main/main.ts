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
// Set true once the user has explicitly chosen to quit (tray menu, app.quit()).
// The widget close handler uses this to decide whether to actually close
// (true) or just hide-to-tray (false — Alt+F4 / OS close).
let isQuitting = false;

app.on('second-instance', () => {
  if (widget && !widget.window.isDestroyed()) {
    if (!widget.window.isVisible()) widget.window.show();
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
        // R2-009: clear pending whenever the widget transitions to expanded
        // (regardless of source — user click, hotkey, tray menu).
        reactions?.notifyModeChanged(mode);
      },
    });

    const reactions = createWidgetReactions({ widget });
    reactions.setPendingNotificationListener((hasPending) => {
      if (widget && !widget.window.isDestroyed()) {
        widget.window.webContents.send(IPC.WIDGET_PENDING_NOTIFICATION, { hasPending });
      }
    });

    // R2-001: intercept user-initiated close (Alt+F4, X button) — hide to
    // tray instead of actually closing. Only the tray "إغلاق" / app.quit()
    // path lets the close go through (isQuitting flag).
    widget.window.on('close', (e) => {
      if (isQuitting) return;
      e.preventDefault();
      widget?.window.hide();
    });

    // R2-005: rebroadcast pending notification flag on did-finish-load too,
    // not just mode + alwaysOnTop. Without this the badge silently disappears
    // on Ctrl+R while the 3s notification timer is still running in main.
    widget.window.webContents.on('did-finish-load', () => {
      if (!widget || widget.window.isDestroyed()) return;
      const w = widget.window.webContents;
      w.send(IPC.WIDGET_MODE_CHANGED, { mode: widget.getMode() });
      w.send(IPC.APP_ALWAYS_ON_TOP_CHANGED, { enabled: widget.isAlwaysOnTop() });
      w.send(IPC.WIDGET_PENDING_NOTIFICATION, { hasPending: reactions.getPending() });
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

    const reconcileAutostart = (): void => {
      // R2-018: the user might toggle autostart externally (Task Manager,
      // Settings → Apps → Startup). Reconcile every time we open the settings
      // window so the toggle reflects the actual registry value, not whatever
      // we cached at boot.
      const registryEnabled = autostart.isEnabled();
      const settingsEnabled = settingsStore.get().autostart;
      if (registryEnabled !== settingsEnabled) {
        settingsStore.set({ autostart: registryEnabled });
      }
    };

    const showSettings = (): void => {
      reconcileAutostart();
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
      // Mark the close handler so it lets the widget actually close.
      isQuitting = true;
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

// R2-001: do NOT quit when the widget window closes — the tray icon keeps
// the app alive. Real quit only happens via tray "إغلاق" → app.quit() →
// before-quit (sets isQuitting) → window close goes through.
app.on('window-all-closed', () => {
  // intentionally empty — defeat Electron's default win32 quit-on-close.
});
