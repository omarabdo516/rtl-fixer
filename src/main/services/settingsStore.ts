// Settings persistence wrapper around electron-store.
// Single JSON file at <userData>/settings.json (or a custom cwd for tests).
// See specs/005-rtl-fixer-v2/data-model.md for the full schema and defaults.

import Store from 'electron-store';
import type { UserPreferences } from '../../shared/types.js';

const DEFAULTS: UserPreferences = {
  schemaVersion: 1,
  theme: 'system',
  layout: 'vertical',
  autostart: true,
  onboardingCompleted: false,
  widget: {
    // First-launch sentinel: main process replaces these with bottom-right of
    // primary monitor once display info is available (see widgetWindow.ts).
    position: { x: -1, y: -1 },
    pinnedEdge: null,
  },
  hotkeys: {
    toggle: 'Control+Shift+R',
    // R2-020: default was Ctrl+Shift+V which collides with Windows Terminal
    // "paste as plain text". Ctrl+Alt+V is unused by Windows + most IDEs.
    render: 'Control+Alt+V',
    copyReply: 'Control+Shift+C',
    clear: 'Control+Shift+X',
  },
  sounds: {
    enabled: false,
    copyChime: true,
    notifyDing: true,
  },
};

export const SETTINGS_DEFAULTS: UserPreferences = DEFAULTS;

export class SettingsValidationError extends Error {
  public readonly field: string;
  public readonly reason: string;
  constructor(field: string, reason: string) {
    super(`Invalid value for "${field}": ${reason}`);
    this.name = 'SettingsValidationError';
    this.field = field;
    this.reason = reason;
  }
}

export interface SettingsStore {
  get(): UserPreferences;
  set(patch: Partial<UserPreferences>): UserPreferences;
  subscribe(cb: (next: UserPreferences) => void): () => void;
}

export interface CreateSettingsStoreOptions {
  cwd?: string;
  defaults?: UserPreferences;
}

const VALID_THEMES = new Set(['light', 'dark', 'system']);
const VALID_LAYOUTS = new Set(['vertical', 'horizontal']);

function validatePatch(patch: Partial<UserPreferences>): void {
  if (patch.theme !== undefined && !VALID_THEMES.has(patch.theme)) {
    throw new SettingsValidationError('theme', `Expected one of light/dark/system, got "${patch.theme}".`);
  }
  if (patch.layout !== undefined && !VALID_LAYOUTS.has(patch.layout)) {
    throw new SettingsValidationError(
      'layout',
      `Expected one of vertical/horizontal, got "${patch.layout}".`,
    );
  }
  if (patch.schemaVersion !== undefined && patch.schemaVersion !== 1) {
    throw new SettingsValidationError(
      'schemaVersion',
      `Only schemaVersion 1 is supported, got ${String(patch.schemaVersion)}.`,
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeDeep<T extends object>(base: T, patch: Partial<T>): T {
  const baseRecord = base as Record<string, unknown>;
  const patchRecord = patch as Record<string, unknown>;
  const result: Record<string, unknown> = { ...baseRecord };
  for (const key of Object.keys(patchRecord)) {
    const value = patchRecord[key];
    if (value === undefined) continue;
    const existing = baseRecord[key];
    if (isPlainObject(value) && isPlainObject(existing)) {
      result[key] = mergeDeep(existing, value as Partial<typeof existing>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export function createSettingsStore(opts: CreateSettingsStoreOptions = {}): SettingsStore {
  const store = new Store<UserPreferences>({
    name: 'settings',
    defaults: opts.defaults ?? DEFAULTS,
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
  });

  return {
    get(): UserPreferences {
      return store.store as UserPreferences;
    },
    set(patch: Partial<UserPreferences>): UserPreferences {
      validatePatch(patch);
      const current = store.store as UserPreferences;
      const next = mergeDeep(current, patch);
      store.store = next;
      return next;
    },
    subscribe(cb: (next: UserPreferences) => void): () => void {
      return store.onDidAnyChange((newValue) => {
        if (newValue) cb(newValue as UserPreferences);
      });
    },
  };
}
