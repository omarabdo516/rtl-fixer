// Translates clipboard events into widget mode transitions per the
// "smart hybrid" behavior in spec.md FR-011 / FR-012.
//
//   expanded mode    → widget stays expanded, renderer auto-fills (no-op here)
//   collapsed mode   → switch to notification for 3s, then back to collapsed
//                      with hasPendingNotification=true
//   notification mode → re-pulse (extend the 3s timer)

import type { WidgetWindowControl } from '../windows/widgetWindow.js';
import type { ClipboardEvent } from '../../shared/types.js';

const NOTIFICATION_HOLD_MS = 3000;

export interface WidgetReactions {
  handleClipboardArabic(event: ClipboardEvent): void;
  setPendingNotificationListener(cb: (hasPending: boolean) => void): void;
  dispose(): void;
}

export interface CreateWidgetReactionsOptions {
  widget: WidgetWindowControl;
}

export function createWidgetReactions(opts: CreateWidgetReactionsOptions): WidgetReactions {
  const { widget } = opts;

  let notifTimer: NodeJS.Timeout | null = null;
  let pendingListener: ((hasPending: boolean) => void) | null = null;

  function clearNotifTimer(): void {
    if (notifTimer !== null) {
      clearTimeout(notifTimer);
      notifTimer = null;
    }
  }

  return {
    handleClipboardArabic(_event: ClipboardEvent): void {
      const mode = widget.getMode();
      if (mode === 'expanded') {
        // Editor already fills the input via renderer subscription; nothing
        // to do at the widget level.
        return;
      }

      // Switch into notification mode for a beat, then settle into collapsed
      // with the badge on.
      widget.setMode('notification');
      pendingListener?.(true);

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
    dispose(): void {
      clearNotifTimer();
      pendingListener = null;
    },
  };
}
