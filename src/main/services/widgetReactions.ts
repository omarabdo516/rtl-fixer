// Translates clipboard events into widget mode transitions per the
// "smart hybrid" behavior in spec.md FR-011 / FR-012.
//
//   expanded mode    → widget stays expanded, renderer auto-fills; pending
//                      state cleared (R2-009)
//   collapsed mode   → switch to notification for 3s, then back to collapsed
//                      with hasPendingNotification=true
//   notification mode → re-pulse (extend the 3s timer)

import type { WidgetWindowControl } from '../windows/widgetWindow.js';
import type { ClipboardEvent } from '../../shared/types.js';

const NOTIFICATION_HOLD_MS = 3000;

export interface WidgetReactions {
  handleClipboardArabic(event: ClipboardEvent): void;
  setPendingNotificationListener(cb: (hasPending: boolean) => void): void;
  /** R2-005: main.ts queries this on did-finish-load to keep the badge
   * state synced with the renderer after a Ctrl+R reload. */
  getPending(): boolean;
  /** R2-009: when the user expands the widget (regardless of source —
   * click, hotkey, tray menu) the pending state should clear. main.ts
   * wires this to widget.onModeChanged. */
  notifyModeChanged(mode: 'collapsed' | 'notification' | 'expanded'): void;
  dispose(): void;
}

export interface CreateWidgetReactionsOptions {
  widget: WidgetWindowControl;
}

export function createWidgetReactions(opts: CreateWidgetReactionsOptions): WidgetReactions {
  const { widget } = opts;

  let notifTimer: NodeJS.Timeout | null = null;
  let pendingListener: ((hasPending: boolean) => void) | null = null;
  let pending = false;

  function clearNotifTimer(): void {
    if (notifTimer !== null) {
      clearTimeout(notifTimer);
      notifTimer = null;
    }
  }

  function setPending(next: boolean): void {
    if (pending === next) return;
    pending = next;
    pendingListener?.(next);
  }

  return {
    handleClipboardArabic(_event: ClipboardEvent): void {
      const mode = widget.getMode();
      if (mode === 'expanded') {
        // Editor already fills the input via renderer subscription. The
        // user is already "looking at it" — no badge needed.
        return;
      }

      widget.setMode('notification');
      setPending(true);

      clearNotifTimer();
      notifTimer = setTimeout(() => {
        notifTimer = null;
        if (widget.getMode() === 'notification') {
          widget.setMode('collapsed');
        }
      }, NOTIFICATION_HOLD_MS);
    },
    setPendingNotificationListener(cb): void {
      pendingListener = cb;
    },
    getPending(): boolean {
      return pending;
    },
    notifyModeChanged(mode): void {
      if (mode === 'expanded') {
        // R2-009: clear pending whenever the user (or hotkey, or tray)
        // brings the widget into expanded — they've now seen the content.
        clearNotifTimer();
        setPending(false);
      }
    },
    dispose(): void {
      clearNotifTimer();
      pendingListener = null;
    },
  };
}
