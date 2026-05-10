// Settings window factory. Lazy-created on first request via tray menu
// or app:showSettings IPC. Standalone (non-floating) BrowserWindow that
// loads settings/settings.html.

import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface CreateSettingsWindowOptions {
  devServerUrl?: string;
}

export function createSettingsWindow(opts: CreateSettingsWindowOptions = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 640,
    title: 'الإعدادات — RTL Fixer',
    show: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    resizable: false,
    skipTaskbar: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (opts.devServerUrl) {
    void win.loadURL(`${opts.devServerUrl}/settings/settings.html`);
  } else {
    void win.loadFile(join(__dirname, '../../renderer/settings/settings.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  return win;
}
