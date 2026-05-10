// Pure validation helpers for hotkey accelerators. Unit-testable without
// an Electron context.

import type { HotkeyAccelerator, HotkeyAction, HotkeyBindings } from '../../shared/types.js';

const VALID_MODIFIERS = new Set([
  'Control',
  'Ctrl',
  'Alt',
  'Shift',
  'Meta',
  'Super',
  'Cmd',
  'CmdOrCtrl',
  'CommandOrControl',
  'AltGr',
  'Option',
]);

export function isValidAccelerator(acc: HotkeyAccelerator): boolean {
  if (typeof acc !== 'string' || acc.length === 0) return false;
  const parts = acc.split('+').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  const modifiers = parts.slice(0, -1);
  const key = parts[parts.length - 1];
  if (!modifiers.every((m) => VALID_MODIFIERS.has(m))) return false;
  if (!key || key.length === 0) return false;
  // Final key must NOT be a modifier on its own
  if (VALID_MODIFIERS.has(key)) return false;
  return true;
}

export function findDuplicateBinding(
  action: HotkeyAction,
  accelerator: HotkeyAccelerator,
  bindings: HotkeyBindings,
): HotkeyAction | null {
  for (const [otherAction, otherAcc] of Object.entries(bindings) as Array<
    [HotkeyAction, HotkeyAccelerator]
  >) {
    if (otherAction !== action && otherAcc === accelerator) {
      return otherAction;
    }
  }
  return null;
}
