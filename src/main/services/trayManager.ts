// System tray icon and context menu (Show / Hide / Settings / Quit).
// Settings menu item is wired to a no-op handler in Phase 4 — the actual
// settings window lands in Phase 5 (US3).

import { app, Menu, Tray, nativeImage } from 'electron';
import { join } from 'node:path';
import type { WidgetWindowControl } from '../windows/widgetWindow.js';

export interface CreateTrayManagerOptions {
  widget: WidgetWindowControl;
  onShowSettings?: () => void;
}

export interface TrayManager {
  destroy(): void;
}

export function createTrayManager(opts: CreateTrayManagerOptions): TrayManager {
  const { widget, onShowSettings } = opts;
  const iconPath = join(app.getAppPath(), 'assets', 'icons', 'tray.ico');
  const image = nativeImage.createFromPath(iconPath);

  const tray = new Tray(image);
  tray.setToolTip('RTL Fixer v2');

  const buildMenu = (): Menu =>
    Menu.buildFromTemplate([
      {
        label: 'إظهار النافذة',
        click: () => widget.setMode('expanded'),
      },
      {
        label: 'تصغير',
        click: () => widget.setMode('collapsed'),
      },
      { type: 'separator' },
      {
        label: 'الإعدادات',
        enabled: onShowSettings !== undefined,
        click: () => onShowSettings?.(),
      },
      { type: 'separator' },
      {
        label: 'إغلاق',
        click: () => app.quit(),
      },
    ]);

  tray.setContextMenu(buildMenu());

  // Single-click on the tray icon brings the widget to expanded mode.
  tray.on('click', () => {
    widget.setMode('expanded');
  });

  return {
    destroy(): void {
      if (!tray.isDestroyed()) tray.destroy();
    },
  };
}
