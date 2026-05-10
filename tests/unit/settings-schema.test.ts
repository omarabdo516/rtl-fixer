import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// electron-store imports the `electron` module to resolve the userData path.
// Stub it so the unit test doesn't need a real Electron context.
vi.mock('electron', () => ({
  app: {
    getPath: () => tmpdir(),
    getName: () => 'rtl-fixer-v2-test',
    getVersion: () => '0.2.0',
  },
}));

import {
  createSettingsStore,
  SETTINGS_DEFAULTS,
  SettingsValidationError,
} from '../../src/main/services/settingsStore.js';

describe('settingsStore', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'rtl-fixer-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns defaults on first load', () => {
    const store = createSettingsStore({ cwd: testDir });
    const prefs = store.get();
    expect(prefs.schemaVersion).toBe(1);
    expect(prefs.theme).toBe('system');
    expect(prefs.layout).toBe('vertical');
    expect(prefs.autostart).toBe(true);
    expect(prefs.onboardingCompleted).toBe(false);
    expect(prefs.hotkeys.toggle).toBe('Control+Shift+R');
    expect(prefs.hotkeys.render).toBe('Control+Alt+V');
    expect(prefs.hotkeys.copyReply).toBe('Control+Shift+C');
    expect(prefs.hotkeys.clear).toBe('Control+Shift+X');
    expect(prefs.sounds.enabled).toBe(false);
  });

  it('persists set values across new stores in the same cwd', () => {
    const a = createSettingsStore({ cwd: testDir });
    a.set({ theme: 'dark' });

    const b = createSettingsStore({ cwd: testDir });
    expect(b.get().theme).toBe('dark');
  });

  it('throws SettingsValidationError on invalid theme', () => {
    const store = createSettingsStore({ cwd: testDir });
    expect(() => store.set({ theme: 'fuchsia' as never })).toThrow(SettingsValidationError);
  });

  it('throws SettingsValidationError on invalid layout', () => {
    const store = createSettingsStore({ cwd: testDir });
    expect(() => store.set({ layout: 'diagonal' as never })).toThrow(SettingsValidationError);
  });

  it('throws on unsupported schemaVersion', () => {
    const store = createSettingsStore({ cwd: testDir });
    expect(() => store.set({ schemaVersion: 2 as never })).toThrow(SettingsValidationError);
  });

  it('merges nested patches correctly', () => {
    const store = createSettingsStore({ cwd: testDir });
    store.set({ sounds: { ...SETTINGS_DEFAULTS.sounds, enabled: true } });
    const prefs = store.get();
    expect(prefs.sounds.enabled).toBe(true);
    expect(prefs.sounds.copyChime).toBe(true);
    expect(prefs.sounds.notifyDing).toBe(true);
  });

  it('merges hotkey rebinding without losing other bindings', () => {
    const store = createSettingsStore({ cwd: testDir });
    store.set({ hotkeys: { ...SETTINGS_DEFAULTS.hotkeys, toggle: 'Control+Shift+T' } });
    const prefs = store.get();
    expect(prefs.hotkeys.toggle).toBe('Control+Shift+T');
    expect(prefs.hotkeys.render).toBe('Control+Alt+V');
    expect(prefs.hotkeys.copyReply).toBe('Control+Shift+C');
    expect(prefs.hotkeys.clear).toBe('Control+Shift+X');
  });

  it('subscribe fires on change', async () => {
    const store = createSettingsStore({ cwd: testDir });
    const cb = vi.fn();
    const unsubscribe = store.subscribe(cb);

    store.set({ theme: 'light' });

    // electron-store onDidAnyChange fires synchronously on the same tick
    // for in-process writes; allow a microtask just in case.
    await Promise.resolve();
    expect(cb).toHaveBeenCalled();

    unsubscribe();
  });

  it('subscribe unsubscribe stops further callbacks', async () => {
    const store = createSettingsStore({ cwd: testDir });
    const cb = vi.fn();
    const unsubscribe = store.subscribe(cb);

    unsubscribe();
    store.set({ theme: 'dark' });
    await Promise.resolve();

    expect(cb).not.toHaveBeenCalled();
  });
});
