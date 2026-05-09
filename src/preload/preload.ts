// Preload script. Builds the typed window.api surface and exposes it to the
// renderer via contextBridge. The renderer never has direct ipcRenderer access.
// Contract: see specs/005-rtl-fixer-v2/contracts/ipc-events.md

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import type {
  ClipboardEvent as RtlClipboardEvent,
  HotkeyAccelerator,
  HotkeyAction,
  HotkeyBindings,
  HotkeySetResult,
  RtlFixerApi,
  UnsubscribeFn,
  UserPreferences,
  WidgetMode,
} from '../shared/types.js';

function on<T>(channel: string, cb: (payload: T) => void): UnsubscribeFn {
  const listener = (_: IpcRendererEvent, payload: T): void => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: RtlFixerApi = {
  prefs: {
    get: () => ipcRenderer.invoke(IPC.PREFS_GET) as Promise<UserPreferences>,
    set: (patch: Partial<UserPreferences>) =>
      ipcRenderer.invoke(IPC.PREFS_SET, patch) as Promise<UserPreferences>,
    onUpdated: (cb) => on<UserPreferences>(IPC.PREFS_UPDATED, cb),
  },
  widget: {
    setMode: (mode: WidgetMode) => ipcRenderer.invoke(IPC.WIDGET_SET_MODE, { mode }) as Promise<void>,
    setPosition: (x: number, y: number) =>
      ipcRenderer.invoke(IPC.WIDGET_SET_POSITION, { x, y }) as Promise<void>,
    onModeChanged: (cb) =>
      on<{ mode: WidgetMode }>(IPC.WIDGET_MODE_CHANGED, ({ mode }) => cb(mode)),
    onPendingNotification: (cb) =>
      on<{ hasPending: boolean }>(IPC.WIDGET_PENDING_NOTIFICATION, ({ hasPending }) =>
        cb(hasPending),
      ),
    requestExpanded: () => ipcRenderer.invoke(IPC.WIDGET_REQUEST_EXPANDED) as Promise<void>,
    requestCollapsed: () => ipcRenderer.invoke(IPC.WIDGET_REQUEST_COLLAPSED) as Promise<void>,
  },
  clipboard: {
    onArabicDetected: (cb) => on<RtlClipboardEvent>(IPC.CLIPBOARD_ARABIC_DETECTED, cb),
    forceRenderCurrent: () =>
      ipcRenderer.invoke(IPC.CLIPBOARD_FORCE_RENDER_CURRENT) as Promise<RtlClipboardEvent | null>,
    writeReply: (text: string) =>
      ipcRenderer.invoke(IPC.CLIPBOARD_WRITE_REPLY, { text }) as Promise<void>,
    writeFormatted: (html: string, plain: string) =>
      ipcRenderer.invoke(IPC.CLIPBOARD_WRITE_FORMATTED, { html, plain }) as Promise<void>,
  },
  hotkeys: {
    getBindings: () => ipcRenderer.invoke(IPC.HOTKEYS_GET_BINDINGS) as Promise<HotkeyBindings>,
    setBinding: (action: HotkeyAction, accelerator: HotkeyAccelerator) =>
      ipcRenderer.invoke(IPC.HOTKEYS_SET_BINDING, { action, accelerator }) as Promise<HotkeySetResult>,
    onConflict: (cb) =>
      on<{ action: HotkeyAction }>(IPC.HOTKEYS_CONFLICT, ({ action }) => cb(action)),
    onTriggered: (cb) =>
      on<{ action: HotkeyAction }>(IPC.HOTKEYS_TRIGGERED, ({ action }) => cb(action)),
  },
  app: {
    quit: () => ipcRenderer.invoke(IPC.APP_QUIT) as Promise<void>,
    setAutostart: (enabled: boolean) =>
      ipcRenderer.invoke(IPC.APP_SET_AUTOSTART, { enabled }) as Promise<boolean>,
    showSettings: () => ipcRenderer.invoke(IPC.APP_SHOW_SETTINGS) as Promise<void>,
    completeOnboarding: () => ipcRenderer.invoke(IPC.APP_COMPLETE_ONBOARDING) as Promise<void>,
    openExternal: (url: string) =>
      ipcRenderer.invoke(IPC.APP_OPEN_EXTERNAL, { url }) as Promise<void>,
  },
  theme: {
    getResolvedTheme: () =>
      ipcRenderer.invoke(IPC.THEME_GET_RESOLVED) as Promise<'light' | 'dark'>,
    onResolvedThemeChanged: (cb) =>
      on<{ theme: 'light' | 'dark' }>(IPC.THEME_RESOLVED_CHANGED, ({ theme }) => cb(theme)),
  },
};

contextBridge.exposeInMainWorld('api', api);
