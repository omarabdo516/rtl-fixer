// IPC handler registration. Phase 2 wires the prefs:* channels only.
// Story-specific channels (clipboard:*, widget:*, hotkeys:*, app:*, theme:*)
// are added in their respective phases.

import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import type { SettingsStore } from '../services/settingsStore.js';
import type { UserPreferences } from '../../shared/types.js';

export interface IpcHandlerDeps {
  settingsStore: SettingsStore;
}

export function registerIpcHandlers(deps: IpcHandlerDeps): void {
  const { settingsStore } = deps;

  ipcMain.handle(IPC.PREFS_GET, () => settingsStore.get());

  ipcMain.handle(IPC.PREFS_SET, (_event, patch: Partial<UserPreferences>) => {
    const next = settingsStore.set(patch);
    broadcast(IPC.PREFS_UPDATED, next);
    return next;
  });

  // Defense in depth: if anything else mutates the store, rebroadcast.
  settingsStore.subscribe((next) => {
    broadcast(IPC.PREFS_UPDATED, next);
  });
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}
