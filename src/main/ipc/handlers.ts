// IPC handler registration. Phase 4 wires prefs:* + clipboard:* + widget:*.
// Story-specific channels for hotkeys:*, app:*, theme:* land in Phase 5.

import { ipcMain, BrowserWindow, clipboard } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import type { SettingsStore } from '../services/settingsStore.js';
import type { ClipboardWatcher } from '../services/clipboardWatcher.js';
import type { SelfFingerprintCache } from '../services/selfFingerprintCache.js';
import type { WidgetWindowControl } from '../windows/widgetWindow.js';
import { fingerprint } from '../services/fingerprint.js';
import type { ClipboardEvent, UserPreferences, WidgetMode } from '../../shared/types.js';

export interface IpcHandlerDeps {
  settingsStore: SettingsStore;
  clipboardWatcher: ClipboardWatcher;
  selfFingerprintCache: SelfFingerprintCache;
  widget: WidgetWindowControl;
}

export function registerIpcHandlers(deps: IpcHandlerDeps): void {
  const { settingsStore, clipboardWatcher, selfFingerprintCache, widget } = deps;

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

  // ─── Clipboard (User Story 1) ──────────────────────────────────
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

  // ─── Widget (User Story 2) ─────────────────────────────────────
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
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}
