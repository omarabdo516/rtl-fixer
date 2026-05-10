// Hotkey manager — wraps Electron's globalShortcut API with conflict
// detection, validation, and a test-friendly trigger() method.

import { globalShortcut } from 'electron';
import type {
  HotkeyAccelerator,
  HotkeyAction,
  HotkeyBindings,
  HotkeySetResult,
} from '../../shared/types.js';
import { findDuplicateBinding, isValidAccelerator } from './hotkeyValidation.js';

export interface HotkeyManagerDeps {
  bindings: HotkeyBindings;
  onTriggered: (action: HotkeyAction) => void;
  onConflict: (action: HotkeyAction) => void;
}

export interface HotkeyManager {
  registerAll(): { conflicts: HotkeyAction[] };
  setBinding(action: HotkeyAction, accelerator: HotkeyAccelerator): HotkeySetResult;
  unregisterAll(): void;
  trigger(action: HotkeyAction): void;
  getBindings(): HotkeyBindings;
}

export function createHotkeyManager(deps: HotkeyManagerDeps): HotkeyManager {
  const bindings: HotkeyBindings = { ...deps.bindings };
  const registered: Partial<Record<HotkeyAction, HotkeyAccelerator>> = {};

  function tryRegister(action: HotkeyAction, accelerator: HotkeyAccelerator): boolean {
    try {
      const ok = globalShortcut.register(accelerator, () => {
        deps.onTriggered(action);
      });
      if (ok && globalShortcut.isRegistered(accelerator)) {
        registered[action] = accelerator;
        return true;
      }
      // Be defensive: if `register` returned false, ensure no leftover state.
      return false;
    } catch {
      return false;
    }
  }

  function unregisterOne(action: HotkeyAction): void {
    const acc = registered[action];
    if (acc !== undefined) {
      try {
        globalShortcut.unregister(acc);
      } catch {
        /* ignore */
      }
      delete registered[action];
    }
  }

  return {
    registerAll(): { conflicts: HotkeyAction[] } {
      const conflicts: HotkeyAction[] = [];
      for (const [action, acc] of Object.entries(bindings) as Array<
        [HotkeyAction, HotkeyAccelerator]
      >) {
        if (!tryRegister(action, acc)) {
          conflicts.push(action);
          deps.onConflict(action);
        }
      }
      return { conflicts };
    },

    setBinding(action: HotkeyAction, accelerator: HotkeyAccelerator): HotkeySetResult {
      if (!isValidAccelerator(accelerator)) {
        return { ok: false, reason: 'invalid-accelerator' };
      }
      if (findDuplicateBinding(action, accelerator, bindings) !== null) {
        return { ok: false, reason: 'duplicate' };
      }
      const previous = bindings[action];
      unregisterOne(action);
      if (!tryRegister(action, accelerator)) {
        // Restore the previous binding on conflict
        tryRegister(action, previous);
        return { ok: false, reason: 'conflict' };
      }
      bindings[action] = accelerator;
      return { ok: true };
    },

    unregisterAll(): void {
      for (const action of Object.keys(registered) as HotkeyAction[]) {
        unregisterOne(action);
      }
    },

    trigger(action: HotkeyAction): void {
      deps.onTriggered(action);
    },

    getBindings(): HotkeyBindings {
      return { ...bindings };
    },
  };
}
