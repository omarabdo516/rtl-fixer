// Widget window factory — Phase 4 wiring.
// Loads widget/index.html (which embeds the editor in its expanded mode).
// Resizes itself based on mode (collapsed 60×60 / notification 240×60 /
// expanded 720×600), persists position with snap-to-edge after every drag,
// and recovers gracefully from monitor changes.

import { BrowserWindow, screen, type Display } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  defaultBottomRightPosition,
  resolveStartupPosition,
  snapToEdge,
  type DisplayWorkArea,
  type WidgetSize,
} from '../services/widgetPosition.js';
import type { SettingsStore } from '../services/settingsStore.js';
import type { PinnedEdge, WidgetMode, WidgetPosition } from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SIZES: Record<WidgetMode, WidgetSize> = {
  collapsed: { width: 60, height: 60 },
  notification: { width: 240, height: 60 },
  expanded: { width: 720, height: 600 },
};

const POSITION_DEBOUNCE_MS = 100;

export interface WidgetWindowControl {
  window: BrowserWindow;
  setMode(mode: WidgetMode): void;
  getMode(): WidgetMode;
  restorePosition(): void;
  swapToWidgetShell(): void;
  destroy(): void;
}

export interface CreateWidgetWindowOptions {
  settingsStore: SettingsStore;
  devServerUrl?: string;
  onModeChanged?: (mode: WidgetMode) => void;
  onPositionPersisted?: (position: WidgetPosition, edge: PinnedEdge) => void;
}

function workAreaToData(display: Display): DisplayWorkArea {
  return display.workArea;
}

export function createWidgetWindow(opts: CreateWidgetWindowOptions): WidgetWindowControl {
  const { settingsStore } = opts;

  const allDisplays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const workAreas = allDisplays.map(workAreaToData);
  const primaryArea = workAreaToData(primary);

  const persisted = settingsStore.get();
  const startup = resolveStartupPosition({
    saved: persisted.widget.position,
    size: SIZES.collapsed,
    workAreas,
    primaryWorkArea: primaryArea,
  });

  let currentMode: WidgetMode = 'collapsed';

  const win = new BrowserWindow({
    width: SIZES.collapsed.width,
    height: SIZES.collapsed.height,
    x: startup.position.x,
    y: startup.position.y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    title: 'RTL Fixer v2',
    webPreferences: {
      preload: join(__dirname, '../../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Reapply alwaysOnTop with explicit level — on Windows, the constructor
  // option alone is sometimes ignored; calling setAlwaysOnTop with a level
  // makes it stick reliably.
  win.setAlwaysOnTop(true, 'pop-up-menu');

  const onboardingDone = persisted.onboardingCompleted;
  const initialEntry = onboardingDone ? 'widget/index.html' : 'onboarding/tour.html';

  if (opts.devServerUrl) {
    void win.loadURL(`${opts.devServerUrl}/${initialEntry}`);
  } else {
    void win.loadFile(join(__dirname, '../../renderer', initialEntry));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  // Persist position changes (with snap) — debounced for native drag events
  let moveTimer: NodeJS.Timeout | null = null;
  win.on('move', () => {
    if (moveTimer !== null) clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      moveTimer = null;
      if (win.isDestroyed()) return;
      const [x, y] = win.getPosition();
      const size = SIZES[currentMode];
      const display = screen.getDisplayMatching({ x, y, width: size.width, height: size.height });
      const result = snapToEdge({ x, y }, size, display.workArea);

      if (result.position.x !== x || result.position.y !== y) {
        win.setPosition(result.position.x, result.position.y);
      }

      settingsStore.set({
        widget: {
          position: result.position,
          pinnedEdge: result.edge,
        },
      });

      opts.onPositionPersisted?.(result.position, result.edge);
    }, POSITION_DEBOUNCE_MS);
  });

  // Multi-monitor recovery — when displays change, reset to a visible position
  // if the saved one is no longer reachable.
  const handleDisplayChange = (): void => {
    if (win.isDestroyed()) return;
    const [x, y] = win.getPosition();
    const size = SIZES[currentMode];
    const updatedAreas = screen.getAllDisplays().map(workAreaToData);
    const updatedPrimary = workAreaToData(screen.getPrimaryDisplay());
    const result = resolveStartupPosition({
      saved: { x, y },
      size,
      workAreas: updatedAreas,
      primaryWorkArea: updatedPrimary,
    });
    if (result.reason === 'recovered-monitor-disconnected') {
      win.setPosition(result.position.x, result.position.y);
      settingsStore.set({
        widget: { position: result.position, pinnedEdge: null },
      });
    }
  };

  screen.on('display-added', handleDisplayChange);
  screen.on('display-removed', handleDisplayChange);
  screen.on('display-metrics-changed', handleDisplayChange);

  win.on('closed', () => {
    screen.removeListener('display-added', handleDisplayChange);
    screen.removeListener('display-removed', handleDisplayChange);
    screen.removeListener('display-metrics-changed', handleDisplayChange);
    if (moveTimer !== null) clearTimeout(moveTimer);
  });

  return {
    window: win,
    swapToWidgetShell(): void {
      const opts2 = opts;
      if (opts2.devServerUrl) {
        void win.loadURL(`${opts2.devServerUrl}/widget/index.html`);
      } else {
        void win.loadFile(join(__dirname, '../../renderer/widget/index.html'));
      }
    },
    setMode(mode: WidgetMode): void {
      if (mode === currentMode) return;
      const prev = currentMode;
      currentMode = mode;
      const size = SIZES[mode];

      // Anchor the window to the same visual corner across modes:
      // when growing from collapsed→expanded, expand toward the LEFT
      // (since collapsed sits in the bottom-right by default).
      const [curX, curY] = win.getPosition();
      const prevSize = SIZES[prev];
      const newX = curX + prevSize.width - size.width;
      const newY = curY + prevSize.height - size.height;

      win.setBounds({ x: newX, y: newY, width: size.width, height: size.height }, true);
      // Pin top in collapsed/notification, allow user to interact in expanded.
      win.setAlwaysOnTop(true);

      opts.onModeChanged?.(mode);
    },
    getMode(): WidgetMode {
      return currentMode;
    },
    restorePosition(): void {
      handleDisplayChange();
    },
    destroy(): void {
      if (!win.isDestroyed()) win.close();
    },
  };
}

// Re-export defaults for callers that need first-launch sentinel detection.
export { defaultBottomRightPosition, SIZES as WIDGET_SIZES };
