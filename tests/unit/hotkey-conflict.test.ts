import { describe, it, expect } from 'vitest';
import {
  findDuplicateBinding,
  isValidAccelerator,
} from '../../src/main/services/hotkeyValidation.js';
import type { HotkeyBindings } from '../../src/shared/types.js';

const DEFAULTS: HotkeyBindings = {
  toggle: 'Control+Shift+R',
  render: 'Control+Alt+V',
  copyReply: 'Control+Shift+C',
  clear: 'Control+Shift+X',
};

describe('isValidAccelerator', () => {
  it('accepts a modifier + key', () => {
    expect(isValidAccelerator('Control+Shift+R')).toBe(true);
    expect(isValidAccelerator('Alt+F4')).toBe(true);
    expect(isValidAccelerator('CmdOrCtrl+S')).toBe(true);
  });

  it('rejects single keys without a modifier', () => {
    expect(isValidAccelerator('R')).toBe(false);
    expect(isValidAccelerator('F1')).toBe(false);
  });

  it('rejects empty / non-string input', () => {
    expect(isValidAccelerator('')).toBe(false);
    expect(isValidAccelerator('+')).toBe(false);
  });

  it('rejects accelerators ending in just a modifier', () => {
    expect(isValidAccelerator('Control+Shift')).toBe(false);
    expect(isValidAccelerator('Alt')).toBe(false);
  });

  it('rejects unknown modifiers', () => {
    expect(isValidAccelerator('Hyper+R')).toBe(false);
  });
});

describe('findDuplicateBinding', () => {
  it('returns null when accelerator is unique', () => {
    expect(findDuplicateBinding('toggle', 'Control+Shift+T', DEFAULTS)).toBeNull();
  });

  it('returns the conflicting action when accelerator is already used', () => {
    expect(findDuplicateBinding('toggle', 'Control+Alt+V', DEFAULTS)).toBe('render');
    expect(findDuplicateBinding('toggle', 'Control+Shift+C', DEFAULTS)).toBe('copyReply');
  });

  it('does NOT report a "duplicate" against the same action keeping its own binding', () => {
    expect(findDuplicateBinding('toggle', 'Control+Shift+R', DEFAULTS)).toBeNull();
  });
});
