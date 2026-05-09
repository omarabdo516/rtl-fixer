// Clipboard watcher. Polls the OS clipboard at a configurable interval, runs
// Arabic detection, filters self-originated content via the fingerprint cache,
// and forwards external Arabic content to a callback (typically broadcasting
// the IPC clipboard:arabicDetected event).

import { clipboard } from 'electron';
import { detectArabic } from '../../shared/arabic.js';
import { fingerprint } from './fingerprint.js';
import type { SelfFingerprintCache } from './selfFingerprintCache.js';
import type { ClipboardEvent } from '../../shared/types.js';

export interface ClipboardWatcherDeps {
  selfFingerprintCache: SelfFingerprintCache;
  onArabicDetected: (event: ClipboardEvent) => void;
  pollIntervalMs?: number;
}

export interface ClipboardWatcher {
  start(): void;
  stop(): void;
  getLastExternalEvent(): ClipboardEvent | null;
}

export function createClipboardWatcher(deps: ClipboardWatcherDeps): ClipboardWatcher {
  const { selfFingerprintCache, onArabicDetected, pollIntervalMs = 500 } = deps;

  let timer: NodeJS.Timeout | null = null;
  let lastSeenText = '';
  let lastExternalEvent: ClipboardEvent | null = null;

  const tick = (): void => {
    let text: string;
    try {
      text = clipboard.readText();
    } catch {
      return;
    }

    if (text === lastSeenText) return;
    lastSeenText = text;

    if (text.length === 0) return;

    const fp = fingerprint(text);

    if (selfFingerprintCache.has(fp)) {
      // Drop self-originated clipboard writes silently.
      return;
    }

    const detection = detectArabic(text);
    if (!detection.containsArabic) return;

    const event: ClipboardEvent = {
      text,
      fingerprint: fp,
      capturedAt: Date.now(),
      origin: 'external',
      containsArabic: true,
    };

    lastExternalEvent = event;
    onArabicDetected(event);
  };

  return {
    start(): void {
      if (timer !== null) return;
      // Capture the current clipboard text on start so we don't fire on
      // whatever was already there before the app launched.
      try {
        lastSeenText = clipboard.readText();
      } catch {
        lastSeenText = '';
      }
      timer = setInterval(tick, pollIntervalMs);
    },
    stop(): void {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
    getLastExternalEvent(): ClipboardEvent | null {
      return lastExternalEvent;
    },
  };
}
