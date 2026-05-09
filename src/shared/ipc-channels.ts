// IPC channel name constants. Single source of truth shared by main and preload.
// See specs/005-rtl-fixer-v2/contracts/ipc-events.md for the complete contract.

export const IPC = {
  // Preferences
  PREFS_GET: 'prefs:get',
  PREFS_SET: 'prefs:set',
  PREFS_UPDATED: 'prefs:updated',

  // Widget
  WIDGET_SET_MODE: 'widget:setMode',
  WIDGET_SET_POSITION: 'widget:setPosition',
  WIDGET_MODE_CHANGED: 'widget:modeChanged',
  WIDGET_PENDING_NOTIFICATION: 'widget:pendingNotification',
  WIDGET_REQUEST_EXPANDED: 'widget:requestExpanded',
  WIDGET_REQUEST_COLLAPSED: 'widget:requestCollapsed',

  // Clipboard
  CLIPBOARD_ARABIC_DETECTED: 'clipboard:arabicDetected',
  CLIPBOARD_FORCE_RENDER_CURRENT: 'clipboard:forceRenderCurrent',
  CLIPBOARD_WRITE_REPLY: 'clipboard:writeReply',
  CLIPBOARD_WRITE_FORMATTED: 'clipboard:writeFormatted',

  // Hotkeys
  HOTKEYS_GET_BINDINGS: 'hotkeys:getBindings',
  HOTKEYS_SET_BINDING: 'hotkeys:setBinding',
  HOTKEYS_TRIGGERED: 'hotkeys:triggered',
  HOTKEYS_CONFLICT: 'hotkeys:conflict',

  // App lifecycle
  APP_QUIT: 'app:quit',
  APP_SET_AUTOSTART: 'app:setAutostart',
  APP_SHOW_SETTINGS: 'app:showSettings',
  APP_COMPLETE_ONBOARDING: 'app:completeOnboarding',
  APP_OPEN_EXTERNAL: 'app:openExternal',

  // Theme
  THEME_GET_RESOLVED: 'theme:getResolved',
  THEME_RESOLVED_CHANGED: 'theme:resolvedChanged',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
