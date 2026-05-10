// System tray icon and context menu (Show / Collapse / Pin-on-top /
// Settings / Quit). The Pin-on-top item is a togglable checkbox that
// reflects the current alwaysOnTop state.

import { app, Menu, Tray, nativeImage } from 'electron';
import { join } from 'node:path';
import type { WidgetWindowControl } from '../windows/widgetWindow.js';

export interface CreateTrayManagerOptions {
  widget: WidgetWindowControl;
  onShowSettings?: () => void;
}

export interface TrayManager {
  refresh(): void;
  destroy(): void;
}

export function createTrayManager(opts: CreateTrayManagerOptions): TrayManager {
  const { widget, onShowSettings } = opts;
  const iconPath = join(app.getAppPath(), 'assets', 'icons', 'tray.ico');
  const image = nativeImage.createFromPath(iconPath);

  const tray = new Tray(image);
  // R2-033: bilingual tooltip — Arabic primary, English subtitle so screen
  // sharers / non-Arabic onlookers immediately understand what the icon is.
  tray.setToolTip('RTL Fixer — كليك للإظهار · يمين للقائمة\nClick to show · right-click for menu');

  // R2-001: tray-driven show. The widget may be hidden (Alt+F4 was
   // intercepted to hide-to-tray instead of close), so explicitly call
   // .show() before setting the mode.
  const showWidget = (mode: 'collapsed' | 'expanded'): void => {
    if (!widget.window.isVisible()) widget.window.show();
    if (widget.window.isMinimized()) widget.window.restore();
    widget.setMode(mode);
  };

  const buildMenu = (): Menu =>
    Menu.buildFromTemplate([
      {
        label: 'إظهار النافذة',
        click: () => showWidget('expanded'),
      },
      {
        label: 'تصغير',
        click: () => showWidget('collapsed'),
      },
      { type: 'separator' },
      {
        label: 'تثبيت فوق كل النوافذ',
        type: 'checkbox',
        checked: widget.isAlwaysOnTop(),
        click: (item) => {
          widget.setAlwaysOnTop(item.checked);
        },
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
    showWidget('expanded');
  });

  return {
    refresh(): void {
      tray.setContextMenu(buildMenu());
    },
    destroy(): void {
      if (!tray.isDestroyed()) tray.destroy();
    },
  };
}
