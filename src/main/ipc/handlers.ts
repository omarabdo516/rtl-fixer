// IPC handler registration. Phase 5 wires the full surface:
// prefs:* + clipboard:* + widget:* + hotkeys:* + app:* + theme:*.

import { ipcMain, BrowserWindow, clipboard, app, shell, nativeTheme } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import type { SettingsStore } from '../services/settingsStore.js';
import type { ClipboardWatcher } from '../services/clipboardWatcher.js';
import type { SelfFingerprintCache } from '../services/selfFingerprintCache.js';
import type { WidgetWindowControl } from '../windows/widgetWindow.js';
import type { HotkeyManager } from '../services/hotkeyManager.js';
import type { AutostartManager } from '../services/autostart.js';
import { fingerprint } from '../services/fingerprint.js';
import type {
  ClipboardEvent,
  HotkeyAccelerator,
  HotkeyAction,
  HotkeyBindings,
  UserPreferences,
  WidgetMode,
} from '../../shared/types.js';

const ALLOWED_EXTERNAL_URL_HOSTS = new Set(['github.com', 'rspaac.com']);

export interface IpcHandlerDeps {
  settingsStore: SettingsStore;
  clipboardWatcher: ClipboardWatcher;
  selfFingerprintCache: SelfFingerprintCache;
  widget: WidgetWindowControl;
  hotkeyManager: HotkeyManager;
  autostart: AutostartManager;
  showSettings: () => void;
  onOnboardingComplete: () => void;
}

export function registerIpcHandlers(deps: IpcHandlerDeps): void {
  const {
    settingsStore,
    clipboardWatcher,
    selfFingerprintCache,
    widget,
    hotkeyManager,
    autostart,
    showSettings,
    onOnboardingComplete,
  } = deps;

  // ─── Preferences ────────────────────────────────────────────────
  ipcMain.handle(IPC.PREFS_GET, () => settingsStore.get());

  ipcMain.handle(IPC.PREFS_SET, (_event, patch: Partial<UserPreferences>) => {
    const next = settingsStore.set(patch);
    broadcast(IPC.PREFS_UPDATED, next);
    return next;
  });

  settingsStore.subscribe((next) => {
    broadcast(IPC.PREFS_UPDATED, next);
  });

  // ─── Clipboard (US1) ───────────────────────────────────────────
  ipcMain.handle(
    IPC.CLIPBOARD_WRITE_REPLY,
    (_event, payload: { text: string }) => {
      const { text } = payload;
      selfFingerprintCache.add(fingerprint(text));
      clipboard.writeText(text);
    },
  );

  ipcMain.handle(
    IPC.CLIPBOARD_WRITE_FORMATTED,
    (_event, payload: { html: string; plain: string }) => {
      const { html, plain } = payload;
      selfFingerprintCache.add(fingerprint(plain));
      selfFingerprintCache.add(fingerprint(html));
      clipboard.write({ html, text: plain });
    },
  );

  ipcMain.handle(IPC.CLIPBOARD_FORCE_RENDER_CURRENT, (): ClipboardEvent | null => {
    const event = clipboardWatcher.getLastExternalEvent();
    if (event !== null) {
      broadcast(IPC.CLIPBOARD_ARABIC_DETECTED, event);
    }
    return event;
  });

  // ─── Widget (US2) ──────────────────────────────────────────────
  ipcMain.handle(IPC.WIDGET_SET_MODE, (_event, payload: { mode: WidgetMode }) => {
    widget.setMode(payload.mode);
  });

  ipcMain.handle(IPC.WIDGET_REQUEST_EXPANDED, () => {
    widget.setMode('expanded');
  });

  ipcMain.handle(IPC.WIDGET_REQUEST_COLLAPSED, () => {
    widget.setMode('collapsed');
  });

  ipcMain.handle(IPC.WIDGET_SET_POSITION, (_event, payload: { x: number; y: number }) => {
    widget.window.setPosition(payload.x, payload.y);
  });

  // ─── Hotkeys (US3) ─────────────────────────────────────────────
  ipcMain.handle(IPC.HOTKEYS_GET_BINDINGS, (): HotkeyBindings => hotkeyManager.getBindings());

  ipcMain.handle(
    IPC.HOTKEYS_SET_BINDING,
    (_event, payload: { action: HotkeyAction; accelerator: HotkeyAccelerator }) => {
      const result = hotkeyManager.setBinding(payload.action, payload.accelerator);
      if (result.ok) {
        const next = settingsStore.set({ hotkeys: hotkeyManager.getBindings() });
        broadcast(IPC.PREFS_UPDATED, next);
      }
      return result;
    },
  );

  // ─── App lifecycle (US3) ───────────────────────────────────────
  ipcMain.handle(IPC.APP_QUIT, () => {
    app.quit();
  });

  ipcMain.handle(IPC.APP_SET_AUTOSTART, (_event, payload: { enabled: boolean }) => {
    const reconciled = autostart.setEnabled(payload.enabled);
    settingsStore.set({ autostart: reconciled });
    return reconciled;
  });

  ipcMain.handle(IPC.APP_SHOW_SETTINGS, () => {
    showSettings();
  });

  ipcMain.handle(IPC.APP_COMPLETE_ONBOARDING, () => {
    settingsStore.set({ onboardingCompleted: true });
    onOnboardingComplete();
  });

  ipcMain.handle(IPC.APP_SET_ALWAYS_ON_TOP, (_event, payload: { enabled: boolean }) => {
    widget.setAlwaysOnTop(payload.enabled);
    const actual = widget.isAlwaysOnTop();
    broadcast(IPC.APP_ALWAYS_ON_TOP_CHANGED, { enabled: actual });
    return actual;
  });

  ipcMain.handle(IPC.APP_GET_ALWAYS_ON_TOP, () => widget.isAlwaysOnTop());

  ipcMain.handle(IPC.APP_OPEN_EXTERNAL, (_event, payload: { url: string }) => {
    let parsed: URL;
    try {
      parsed = new URL(payload.url);
    } catch {
      throw new Error('INVALID_URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new Error('INVALID_URL');
    }
    if (!ALLOWED_EXTERNAL_URL_HOSTS.has(parsed.hostname)) {
      throw new Error('INVALID_URL');
    }
    void shell.openExternal(parsed.toString());
  });

  // ─── Theme ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.THEME_GET_RESOLVED, () => resolveTheme(settingsStore));

  nativeTheme.on('updated', () => {
    broadcast(IPC.THEME_RESOLVED_CHANGED, { theme: resolveTheme(settingsStore) });
  });
}

function resolveTheme(settingsStore: SettingsStore): 'light' | 'dark' {
  const theme = settingsStore.get().theme;
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}
