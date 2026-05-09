// Shared TypeScript types for RTL Fixer v2.
// Imported by both main and renderer processes. Type-only — no runtime code here.

export type WidgetMode = 'collapsed' | 'notification' | 'expanded';

export type Theme = 'light' | 'dark' | 'system';

export type Layout = 'vertical' | 'horizontal';

export type HotkeyAction = 'toggle' | 'render' | 'copyReply' | 'clear';

export type HotkeyAccelerator = string;

export type HotkeyBindings = Record<HotkeyAction, HotkeyAccelerator>;

export type HotkeySetResult =
  | { ok: true }
  | { ok: false; reason: 'conflict' | 'invalid-accelerator' | 'duplicate' };

export type ClipboardOrigin = 'external' | 'self';

export interface ClipboardEvent {
  text: string;
  fingerprint: string;
  capturedAt: number;
  origin: ClipboardOrigin;
  containsArabic: boolean;
}

export interface ArabicDetectionResult {
  containsArabic: boolean;
  arabicCharCount: number;
  totalCharCount: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export type PinnedEdge = 'top' | 'bottom' | 'left' | 'right' | null;

export interface PersistedWidgetState {
  position: WidgetPosition;
  pinnedEdge: PinnedEdge;
}

export interface WidgetState extends PersistedWidgetState {
  mode: WidgetMode;
  visible: boolean;
  opacity: number;
  hasPendingNotification: boolean;
}

export interface SoundsPreferences {
  enabled: boolean;
  copyChime: boolean;
  notifyDing: boolean;
}

export interface UserPreferences {
  schemaVersion: 1;
  theme: Theme;
  layout: Layout;
  autostart: boolean;
  onboardingCompleted: boolean;
  widget: PersistedWidgetState;
  hotkeys: HotkeyBindings;
  sounds: SoundsPreferences;
}

export type UnsubscribeFn = () => void;

export interface RtlFixerApi {
  prefs: {
    get(): Promise<UserPreferences>;
    set(patch: Partial<UserPreferences>): Promise<UserPreferences>;
    onUpdated(cb: (next: UserPreferences) => void): UnsubscribeFn;
  };
  widget: {
    setMode(mode: WidgetMode): Promise<void>;
    setPosition(x: number, y: number): Promise<void>;
    onModeChanged(cb: (mode: WidgetMode) => void): UnsubscribeFn;
    onPendingNotification(cb: (hasPending: boolean) => void): UnsubscribeFn;
    requestExpanded(): Promise<void>;
    requestCollapsed(): Promise<void>;
  };
  clipboard: {
    onArabicDetected(cb: (event: ClipboardEvent) => void): UnsubscribeFn;
    forceRenderCurrent(): Promise<ClipboardEvent | null>;
    writeReply(text: string): Promise<void>;
    writeFormatted(html: string, plain: string): Promise<void>;
  };
  hotkeys: {
    getBindings(): Promise<HotkeyBindings>;
    setBinding(action: HotkeyAction, accelerator: HotkeyAccelerator): Promise<HotkeySetResult>;
    onConflict(cb: (action: HotkeyAction) => void): UnsubscribeFn;
    onTriggered(cb: (action: HotkeyAction) => void): UnsubscribeFn;
  };
  app: {
    quit(): Promise<void>;
    setAutostart(enabled: boolean): Promise<boolean>;
    showSettings(): Promise<void>;
    completeOnboarding(): Promise<void>;
    openExternal(url: string): Promise<void>;
  };
  theme: {
    getResolvedTheme(): Promise<'light' | 'dark'>;
    onResolvedThemeChanged(cb: (t: 'light' | 'dark') => void): UnsubscribeFn;
  };
}
