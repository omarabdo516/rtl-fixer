// IPC handler registration. Phase 3 wires prefs:* + clipboard:*.
// Story-specific channels for widget:*, hotkeys:*, app:*, theme:* land in
// their respective phases.

import { ipcMain, BrowserWindow, clipboard } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import type { SettingsStore } from '../services/settingsStore.js';
import type { ClipboardWatcher } from '../services/clipboardWatcher.js';
import type { SelfFingerprintCache } from '../services/selfFingerprintCache.js';
import { fingerprint } from '../services/fingerprint.js';
import type { ClipboardEvent, UserPreferences } from '../../shared/types.js';

export interface IpcHandlerDeps {
  settingsStore: SettingsStore;
  clipboardWatcher: ClipboardWatcher;
  selfFingerprintCache: SelfFingerprintCache;
}

export function registerIpcHandlers(deps: IpcHandlerDeps): void {
  const { settingsStore, clipboardWatcher, selfFingerprintCache } = deps;

  // Preferences -----------------------------------------------------------
  ipcMain.handle(IPC.PREFS_GET, () => settingsStore.get());

  ipcMain.handle(IPC.PREFS_SET, (_event, patch: Partial<UserPreferences>) => {
    const next = settingsStore.set(patch);
    broadcast(IPC.PREFS_UPDATED, next);
    return next;
  });

  settingsStore.subscribe((next) => {
    broadcast(IPC.PREFS_UPDATED, next);
  });

  // Clipboard (User Story 1) ---------------------------------------------
  ipcMain.handle(
    IPC.CLIPBOARD_WRITE_REPLY,
    (_event, payload: { text: string }) => {
      const { text } = payload;
      // Push fingerprint BEFORE writing so the watcher's next tick recognizes
      // the content as self-originated.
      selfFingerprintCache.add(fingerprint(text));
      clipboard.writeText(text);
    },
  );

  ipcMain.handle(
    IPC.CLIPBOARD_WRITE_FORMATTED,
    (_event, payload: { html: string; plain: string }) => {
      const { html, plain } = payload;
      selfFingerprintCache.add(fingerprint(plain));
      // Some apps read the html branch only; cache that fingerprint too in
      // case the watcher sees html-as-text on the next tick.
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
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}
