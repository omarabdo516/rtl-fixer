// Pure widget-position helpers — exported for unit testing without an
// Electron context. The widgetWindow module wires these to live `screen`
// data at runtime.

import type { PinnedEdge, WidgetPosition } from '../../shared/types.js';

export interface DisplayWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

const DEFAULT_INSET = 24;
const SNAP_THRESHOLD = 20;

export function defaultBottomRightPosition(
  workArea: DisplayWorkArea,
  size: WidgetSize,
): WidgetPosition {
  return {
    x: workArea.x + workArea.width - size.width - DEFAULT_INSET,
    y: workArea.y + workArea.height - size.height - DEFAULT_INSET,
  };
}

export function isPositionVisible(
  position: WidgetPosition,
  size: WidgetSize,
  workAreas: DisplayWorkArea[],
): boolean {
  return workAreas.some(
    (wa) =>
      position.x >= wa.x &&
      position.x + size.width <= wa.x + wa.width &&
      position.y >= wa.y &&
      position.y + size.height <= wa.y + wa.height,
  );
}

export interface SnapResult {
  position: WidgetPosition;
  edge: PinnedEdge;
}

export function snapToEdge(
  position: WidgetPosition,
  size: WidgetSize,
  workArea: DisplayWorkArea,
): SnapResult {
  let { x, y } = position;
  let edge: PinnedEdge = null;

  const distRight = Math.abs(x + size.width - (workArea.x + workArea.width));
  const distLeft = Math.abs(x - workArea.x);
  const distBottom = Math.abs(y + size.height - (workArea.y + workArea.height));
  const distTop = Math.abs(y - workArea.y);

  // Horizontal snap (prefer the closer edge if both within threshold)
  if (distRight <= SNAP_THRESHOLD && distRight <= distLeft) {
    x = workArea.x + workArea.width - size.width;
    edge = 'right';
  } else if (distLeft <= SNAP_THRESHOLD) {
    x = workArea.x;
    edge = 'left';
  }

  // Vertical snap (only override edge if no horizontal snap happened)
  if (distBottom <= SNAP_THRESHOLD && distBottom <= distTop) {
    y = workArea.y + workArea.height - size.height;
    if (edge === null) edge = 'bottom';
  } else if (distTop <= SNAP_THRESHOLD) {
    y = workArea.y;
    if (edge === null) edge = 'top';
  }

  return { position: { x, y }, edge };
}

export interface ResolvePositionInput {
  saved: WidgetPosition | null;
  size: WidgetSize;
  workAreas: DisplayWorkArea[];
  primaryWorkArea: DisplayWorkArea;
}

export interface ResolvePositionResult {
  position: WidgetPosition;
  reason: 'restored' | 'default-first-launch' | 'recovered-monitor-disconnected';
}

const FIRST_LAUNCH_SENTINEL_X = -1;
const FIRST_LAUNCH_SENTINEL_Y = -1;

export function resolveStartupPosition(input: ResolvePositionInput): ResolvePositionResult {
  const { saved, size, workAreas, primaryWorkArea } = input;
  const fallback = defaultBottomRightPosition(primaryWorkArea, size);

  if (
    saved === null ||
    (saved.x === FIRST_LAUNCH_SENTINEL_X && saved.y === FIRST_LAUNCH_SENTINEL_Y)
  ) {
    return { position: fallback, reason: 'default-first-launch' };
  }

  if (isPositionVisible(saved, size, workAreas)) {
    return { position: saved, reason: 'restored' };
  }

  return { position: fallback, reason: 'recovered-monitor-disconnected' };
}
