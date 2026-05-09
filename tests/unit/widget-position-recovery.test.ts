import { describe, it, expect } from 'vitest';
import {
  defaultBottomRightPosition,
  isPositionVisible,
  resolveStartupPosition,
  snapToEdge,
} from '../../src/main/services/widgetPosition.js';

const PRIMARY = { x: 0, y: 0, width: 1920, height: 1040 }; // 1080 minus taskbar
const SECONDARY = { x: 1920, y: 0, width: 1920, height: 1040 };
const COLLAPSED = { width: 60, height: 60 };
const EXPANDED = { width: 720, height: 600 };

describe('defaultBottomRightPosition', () => {
  it('returns bottom-right corner with 24px inset', () => {
    const pos = defaultBottomRightPosition(PRIMARY, COLLAPSED);
    expect(pos.x).toBe(1920 - 60 - 24); // 1836
    expect(pos.y).toBe(1040 - 60 - 24); // 956
  });

  it('respects monitor offset for non-primary work areas', () => {
    const pos = defaultBottomRightPosition(SECONDARY, COLLAPSED);
    expect(pos.x).toBe(1920 + 1920 - 60 - 24);
    expect(pos.y).toBe(1040 - 60 - 24);
  });
});

describe('isPositionVisible', () => {
  it('returns true for a position fully inside the primary work area', () => {
    expect(isPositionVisible({ x: 100, y: 100 }, COLLAPSED, [PRIMARY])).toBe(true);
  });

  it('returns false when the widget would extend past the right edge', () => {
    expect(isPositionVisible({ x: 1900, y: 100 }, COLLAPSED, [PRIMARY])).toBe(false);
  });

  it('returns true when position is on a secondary monitor', () => {
    expect(
      isPositionVisible({ x: 2000, y: 500 }, COLLAPSED, [PRIMARY, SECONDARY]),
    ).toBe(true);
  });

  it('returns false when secondary monitor is removed', () => {
    expect(
      isPositionVisible({ x: 2000, y: 500 }, COLLAPSED, [PRIMARY]),
    ).toBe(false);
  });
});

describe('snapToEdge', () => {
  it('snaps to right edge when within 20px', () => {
    // Right edge of widget at x = 1920 - 65 + 60 = 1915 (5px from right edge of work area)
    const result = snapToEdge({ x: 1855, y: 500 }, COLLAPSED, PRIMARY);
    expect(result.edge).toBe('right');
    expect(result.position.x).toBe(1920 - 60); // flush right
  });

  it('snaps to left edge when within 20px', () => {
    const result = snapToEdge({ x: 10, y: 500 }, COLLAPSED, PRIMARY);
    expect(result.edge).toBe('left');
    expect(result.position.x).toBe(0);
  });

  it('snaps to bottom edge when within 20px', () => {
    const result = snapToEdge({ x: 500, y: 985 }, COLLAPSED, PRIMARY);
    expect(result.edge).toBe('bottom');
    expect(result.position.y).toBe(1040 - 60);
  });

  it('does NOT snap when farther than 20px from any edge', () => {
    const result = snapToEdge({ x: 500, y: 500 }, COLLAPSED, PRIMARY);
    expect(result.edge).toBeNull();
    expect(result.position.x).toBe(500);
    expect(result.position.y).toBe(500);
  });

  it('horizontal edge takes precedence over vertical when both within threshold', () => {
    // Within 20px of both right and bottom — should pick a horizontal edge
    const result = snapToEdge({ x: 1855, y: 985 }, COLLAPSED, PRIMARY);
    expect(result.edge).toBe('right');
    expect(result.position.x).toBe(1920 - 60);
    expect(result.position.y).toBe(1040 - 60); // bottom snap also applied to y
  });
});

describe('resolveStartupPosition', () => {
  it('returns default bottom-right on first launch (sentinel position)', () => {
    const result = resolveStartupPosition({
      saved: { x: -1, y: -1 },
      size: COLLAPSED,
      workAreas: [PRIMARY],
      primaryWorkArea: PRIMARY,
    });
    expect(result.reason).toBe('default-first-launch');
    expect(result.position.x).toBe(1920 - 60 - 24);
  });

  it('restores saved position when still visible', () => {
    const result = resolveStartupPosition({
      saved: { x: 100, y: 100 },
      size: COLLAPSED,
      workAreas: [PRIMARY],
      primaryWorkArea: PRIMARY,
    });
    expect(result.reason).toBe('restored');
    expect(result.position).toEqual({ x: 100, y: 100 });
  });

  it('falls back to default when saved monitor is disconnected', () => {
    const result = resolveStartupPosition({
      saved: { x: 2500, y: 500 }, // on secondary
      size: COLLAPSED,
      workAreas: [PRIMARY], // secondary disconnected
      primaryWorkArea: PRIMARY,
    });
    expect(result.reason).toBe('recovered-monitor-disconnected');
    expect(result.position.x).toBe(1920 - 60 - 24);
  });

  it('treats null saved as first launch', () => {
    const result = resolveStartupPosition({
      saved: null,
      size: EXPANDED,
      workAreas: [PRIMARY],
      primaryWorkArea: PRIMARY,
    });
    expect(result.reason).toBe('default-first-launch');
    expect(result.position.x).toBe(1920 - 720 - 24);
  });
});
