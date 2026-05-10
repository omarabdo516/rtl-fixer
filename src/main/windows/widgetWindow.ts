// Widget window factory.
// Three visual modes: collapsed 60×60 / notification 240×60 / expanded 720×600.
// First-launch shows the onboarding tour at 480×640 centered, then swaps
// to the widget shell at the persisted (or default) position once the user
// finishes the tour.

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

const TOUR_SIZE: WidgetSize = { width: 480, height: 640 };
const POSITION_DEBOUNCE_MS = 100;
// How long to ignore 'move' events after a programmatic setBounds. The OS
// can fire several spurious move ticks during a resize+reposition, all of
// which would otherwise overwrite the user-persisted position.
const PROGRAMMATIC_MOVE_GUARD_MS = 250;

export interface WidgetWindowControl {
  window: BrowserWindow;
  setMode(mode: WidgetMode): void;
  getMode(): WidgetMode;
  restorePosition(): void;
  swapToWidgetShell(): void;
  setAlwaysOnTop(enabled: boolean): void;
  isAlwaysOnTop(): boolean;
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

function centeredPosition(area: DisplayWorkArea, size: WidgetSize): WidgetPosition {
  return {
    x: area.x + Math.max(0, Math.floor((area.width - size.width) / 2)),
    y: area.y + Math.max(0, Math.floor((area.height - size.height) / 2)),
  };
}

export function createWidgetWindow(opts: CreateWidgetWindowOptions): WidgetWindowControl {
  const { settingsStore } = opts;

  const allDisplays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const workAreas = allDisplays.map(workAreaToData);
  const primaryArea = workAreaToData(primary);

  const persisted = settingsStore.get();
  const onboardingDone = persisted.onboardingCompleted;

  // Initial size + position depend on whether we're in onboarding mode.
  // Tour: large window centered. Widget: collapsed bubble at saved/default pos.
  const initialSize = onboardingDone ? SIZES.collapsed : TOUR_SIZE;
  const initialPosition = onboardingDone
    ? resolveStartupPosition({
        saved: persisted.widget.position,
        size: SIZES.collapsed,
        workAreas,
        primaryWorkArea: primaryArea,
      }).position
    : centeredPosition(primaryArea, TOUR_SIZE);

  let currentMode: WidgetMode = 'collapsed';
  // Skip the move debounce while we're applying programmatic bounds changes
  // (mode transitions, tour→widget swap). Without this the persisted
  // position drifts every time the user expands or collapses the widget.
  let suppressMoveUntil = 0;

  const win = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    x: initialPosition.x,
    y: initialPosition.y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    minWidth: 60,
    minHeight: 60,
    title: 'RTL Fixer v2',
    webPreferences: {
      preload: join(__dirname, '../../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 'floating' is the gentlest level that still keeps the window above
  // ordinary windows. 'pop-up-menu' was overriding fullscreen apps and
  // making the widget feel intrusive.
  win.setAlwaysOnTop(true, 'floating');

  const initialEntry = onboardingDone ? 'widget/index.html' : 'onboarding/tour.html';

  if (opts.devServerUrl) {
    void win.loadURL(`${opts.devServerUrl}/${initialEntry}`);
  } else {
    void win.loadFile(join(__dirname, '../../renderer', initialEntry));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  // Persist position changes (with snap) — debounced for native drag events.
  // Skipped during programmatic setBounds calls (see setMode + swap).
  let moveTimer: NodeJS.Timeout | null = null;
  win.on('move', () => {
    if (Date.now() < suppressMoveUntil) return;
    if (moveTimer !== null) clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      moveTimer = null;
      if (win.isDestroyed()) return;
      if (Date.now() < suppressMoveUntil) return;

      const [x, y] = win.getPosition();
      const size = SIZES[currentMode];
      const display = screen.getDisplayMatching({ x, y, width: size.width, height: size.height });
      const result = snapToEdge({ x, y }, size, display.workArea);

      if (result.position.x !== x || result.position.y !== y) {
        suppressMoveUntil = Date.now() + PROGRAMMATIC_MOVE_GUARD_MS;
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
      suppressMoveUntil = Date.now() + PROGRAMMATIC_MOVE_GUARD_MS;
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
      // Resize from tour 480×640 to collapsed 60×60 + reposition to the
      // saved/default widget spot, all under the suppress-move guard so the
      // 'move' handler doesn't persist transient positions.
      const updatedPersisted = settingsStore.get();
      const widgetStartup = resolveStartupPosition({
        saved: updatedPersisted.widget.position,
        size: SIZES.collapsed,
        workAreas: screen.getAllDisplays().map(workAreaToData),
        primaryWorkArea: workAreaToData(screen.getPrimaryDisplay()),
      });

      suppressMoveUntil = Date.now() + PROGRAMMATIC_MOVE_GUARD_MS;
      win.setBounds({
        x: widgetStartup.position.x,
        y: widgetStartup.position.y,
        width: SIZES.collapsed.width,
        height: SIZES.collapsed.height,
      });

      currentMode = 'collapsed';

      if (opts.devServerUrl) {
        void win.loadURL(`${opts.devServerUrl}/widget/index.html`);
      } else {
        void win.loadFile(join(__dirname, '../../renderer/widget/index.html'));
      }
    },
    setMode(mode: WidgetMode): void {
      if (mode === currentMode) return;
      const prev = currentMode;
      currentMode = mode;
      const size = SIZES[mode];

      const [curX, curY] = win.getPosition();
      const prevSize = SIZES[prev];
      const newX = curX + prevSize.width - size.width;
      const newY = curY + prevSize.height - size.height;

      suppressMoveUntil = Date.now() + PROGRAMMATIC_MOVE_GUARD_MS;
      win.setBounds({ x: newX, y: newY, width: size.width, height: size.height }, true);
      win.setAlwaysOnTop(true, 'floating');

      opts.onModeChanged?.(mode);
    },
    getMode(): WidgetMode {
      return currentMode;
    },
    restorePosition(): void {
      handleDisplayChange();
    },
    setAlwaysOnTop(enabled: boolean): void {
      if (enabled) {
        win.setAlwaysOnTop(true, 'floating');
      } else {
        win.setAlwaysOnTop(false);
      }
    },
    isAlwaysOnTop(): boolean {
      return win.isAlwaysOnTop();
    },
    destroy(): void {
      if (!win.isDestroyed()) win.close();
    },
  };
}

// Re-export defaults for callers that need first-launch sentinel detection.
export { defaultBottomRightPosition, SIZES as WIDGET_SIZES };
