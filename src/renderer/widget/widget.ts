// Widget shell controller — handles mode transitions, drag-to-move,
// click-to-expand, auto-fade, and reactions to clipboard / pending-
// notification IPC events.
//
// Drag implementation note: we don't use -webkit-app-region: drag on the
// collapsed bubble because that swallows click events. Instead pointer
// events are used directly: if the cursor moves more than DRAG_THRESHOLD
// pixels between pointerdown and pointerup, treat it as a drag (and forward
// position changes to main); otherwise treat it as a click (expand).

import type { WidgetMode } from '../../shared/types.js';

const $body = document.body;
const $collapsed = document.getElementById('collapsed') as HTMLElement | null;
const $expanded = document.getElementById('expanded') as HTMLElement | null;
const $notification = document.getElementById('notification') as HTMLElement | null;
const $bubblePulse = document.getElementById('bubble-pulse') as HTMLElement | null;
const $bubbleBadge = document.getElementById('bubble-badge') as HTMLElement | null;
const $collapseBtn = document.getElementById('widget-collapse-btn') as HTMLButtonElement | null;
const $pinBtn = document.getElementById('widget-pin-btn') as HTMLButtonElement | null;
const $settingsBtn = document.getElementById('widget-settings-btn') as HTMLButtonElement | null;

if (!$collapsed || !$expanded || !$notification || !$bubblePulse || !$bubbleBadge || !$collapseBtn || !$pinBtn || !$settingsBtn) {
  throw new Error('widget.ts: missing required DOM elements');
}

let currentMode: WidgetMode = 'collapsed';
const FADE_DELAY_MS = 5000;
const DRAG_THRESHOLD_PX = 4;
let fadeTimer: number | undefined;

function setMode(mode: WidgetMode): void {
  currentMode = mode;
  $body.dataset.mode = mode;
  $body.classList.remove('is-faded');
  cancelFadeTimer();
  if (mode === 'collapsed') {
    schedulePossibleFade();
  }
  // Announce mode change to screen readers via the off-screen live region.
  const $live = document.getElementById('widget-live');
  if ($live) {
    $live.textContent =
      mode === 'expanded' ? 'النافذة مفتوحة' :
      mode === 'collapsed' ? 'النافذة مطوية' :
      'نص جديد متاح';
  }
}

function pulse(): void {
  $collapsed!.classList.remove('is-pulsing');
  void $collapsed!.offsetWidth; // restart animation
  $collapsed!.classList.add('is-pulsing');
}

function setPendingBadge(visible: boolean): void {
  if (visible) {
    $bubbleBadge!.removeAttribute('hidden');
  } else {
    $bubbleBadge!.setAttribute('hidden', '');
  }
}

// ─── Drag-or-click on collapsed bubble ───────────────────────────

interface DragSession {
  initialWinX: number;
  initialWinY: number;
  initialMouseX: number;
  initialMouseY: number;
  didMove: boolean;
}

let drag: DragSession | null = null;

$collapsed.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button !== 0) return;
  // Window position derived from the screen-vs-client offset at pointerdown.
  drag = {
    initialWinX: e.screenX - e.clientX,
    initialWinY: e.screenY - e.clientY,
    initialMouseX: e.screenX,
    initialMouseY: e.screenY,
    didMove: false,
  };
  $collapsed!.setPointerCapture(e.pointerId);
});

$collapsed.addEventListener('pointermove', (e: PointerEvent) => {
  if (!drag) return;
  const dx = e.screenX - drag.initialMouseX;
  const dy = e.screenY - drag.initialMouseY;
  if (!drag.didMove && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
    drag.didMove = true;
  }
  if (drag.didMove) {
    void window.api.widget.setPosition(drag.initialWinX + dx, drag.initialWinY + dy);
  }
});

// Track whether the most recent pointerup ended in a drag, so the trailing
// `click` event (which keyboard activations also use) doesn't double-expand.
let lastPointerWasDrag = false;

$collapsed.addEventListener('pointerup', (e: PointerEvent) => {
  if (!drag) return;
  if ($collapsed!.hasPointerCapture(e.pointerId)) {
    $collapsed!.releasePointerCapture(e.pointerId);
  }
  lastPointerWasDrag = drag.didMove;
  drag = null;
});

$collapsed.addEventListener('pointercancel', () => {
  drag = null;
});

// Click fires on both pointer-released (no drag) and keyboard activation
// (Enter/Space on the <button>). Skip if the pointer event was actually a drag.
$collapsed.addEventListener('click', () => {
  if (lastPointerWasDrag) {
    lastPointerWasDrag = false;
    return;
  }
  setPendingBadge(false);
  void window.api.widget.requestExpanded();
});

// ─── Notification bar click → expand ─────────────────────────────

$notification.addEventListener('click', () => {
  setPendingBadge(false);
  void window.api.widget.requestExpanded();
});

// ─── Expanded mode: collapse button ──────────────────────────────

$collapseBtn.addEventListener('click', () => {
  void window.api.widget.requestCollapsed();
});

// ─── Settings entry ─────────────────────────────────────────────

$settingsBtn.addEventListener('click', () => {
  void window.api.app.showSettings();
});

// ─── Pin-on-top toggle ──────────────────────────────────────────

function reflectPinState(enabled: boolean): void {
  $pinBtn!.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  const label = enabled ? 'مثبّت فوق — دوس عشان تشيل التثبيت' : 'مش مثبّت — دوس عشان تثبّت فوق';
  $pinBtn!.title = label;
  $pinBtn!.setAttribute('aria-label', label);
}

$pinBtn.addEventListener('click', async () => {
  const current = $pinBtn!.getAttribute('aria-pressed') === 'true';
  const next = !current;
  const actual = await window.api.app.setAlwaysOnTop(next);
  reflectPinState(actual);
});

window.api.app.onAlwaysOnTopChanged((enabled) => {
  reflectPinState(enabled);
});

void window.api.app.getAlwaysOnTop().then((enabled) => {
  reflectPinState(enabled);
});

// ─── Auto-fade (collapsed only, idle 5s) ─────────────────────────

function schedulePossibleFade(): void {
  cancelFadeTimer();
  if (currentMode !== 'collapsed') return;
  fadeTimer = window.setTimeout(() => {
    if (currentMode === 'collapsed') {
      $body.classList.add('is-faded');
    }
  }, FADE_DELAY_MS);
}

function cancelFadeTimer(): void {
  if (fadeTimer !== undefined) {
    clearTimeout(fadeTimer);
    fadeTimer = undefined;
  }
  $body.classList.remove('is-faded');
}

$body.addEventListener('mouseenter', cancelFadeTimer);
$body.addEventListener('mouseleave', schedulePossibleFade);

// ─── IPC subscriptions ───────────────────────────────────────────

window.api.widget.onModeChanged((mode) => {
  setMode(mode);
});

window.api.widget.onPendingNotification((hasPending) => {
  setPendingBadge(hasPending);
  if (hasPending && currentMode === 'collapsed') {
    pulse();
  }
});

if (window.api?.clipboard?.onArabicDetected) {
  window.api.clipboard.onArabicDetected(() => {
    if (currentMode === 'collapsed' || currentMode === 'notification') {
      pulse();
    }
  });
}

// ─── Global hotkey reactions (US3) ───────────────────────────────

if (window.api?.hotkeys?.onTriggered) {
  window.api.hotkeys.onTriggered((action) => {
    switch (action) {
      case 'toggle':
        if (currentMode === 'expanded') {
          void window.api.widget.requestCollapsed();
        } else {
          void window.api.widget.requestExpanded();
        }
        break;
      case 'render':
        void window.api.clipboard.forceRenderCurrent();
        void window.api.widget.requestExpanded();
        break;
      case 'copyReply': {
        const $reply = document.getElementById('reply') as HTMLTextAreaElement | null;
        const text = $reply?.value.trim();
        if (text) void window.api.clipboard.writeReply(text);
        break;
      }
      case 'clear': {
        const $input = document.getElementById('input') as HTMLTextAreaElement | null;
        const $output = document.getElementById('output');
        const $reply = document.getElementById('reply') as HTMLTextAreaElement | null;
        if ($input) $input.value = '';
        if ($output) $output.innerHTML = '';
        if ($reply) $reply.value = '';
        $input?.dispatchEvent(new Event('input'));
        $reply?.dispatchEvent(new Event('input'));
        break;
      }
    }
  });
}

// ─── Init ────────────────────────────────────────────────────────

setMode('collapsed');
schedulePossibleFade();
