// Widget window factory. Phase 3 MVP: a single frameless transparent
// always-on-top window that loads the migrated v1 editor. Three-mode
// state (collapsed / notification / expanded) lands in Phase 4 (US2).

import { BrowserWindow, screen } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WIDGET_WIDTH = 720;
const WIDGET_HEIGHT = 600;
const EDGE_INSET = 24;

export interface CreateWidgetWindowOptions {
  devServerUrl?: string;
}

export function createWidgetWindow(opts: CreateWidgetWindowOptions = {}): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  const x = workArea.x + workArea.width - WIDGET_WIDTH - EDGE_INSET;
  const y = workArea.y + workArea.height - WIDGET_HEIGHT - EDGE_INSET;

  const win = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    title: 'RTL Fixer v2',
    webPreferences: {
      preload: join(__dirname, '../../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (opts.devServerUrl) {
    void win.loadURL(`${opts.devServerUrl}/editor/editor.html`);
  } else {
    void win.loadFile(join(__dirname, '../../renderer/editor/editor.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  return win;
}
