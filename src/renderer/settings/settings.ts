// Settings panel controller. Loads UserPreferences via window.api.prefs.get,
// renders form values, and writes back changes via window.api.prefs.set
// + window.api.hotkeys.setBinding for hotkey rebinds.

import type {
  HotkeyAction,
  HotkeyBindings,
  Layout,
  Theme,
  UserPreferences,
} from '../../shared/types.js';
import { initTheme } from '../shared/theme.js';

initTheme();

const HOTKEY_ACTIONS: readonly HotkeyAction[] = ['toggle', 'render', 'copyReply', 'clear'];

// Arabic labels for each action — used in user-facing status messages so we
// don't print raw camelCase identifiers like "copyReply" inside Arabic text.
const ACTION_LABELS: Record<HotkeyAction, string> = {
  toggle: 'الإظهار/الإخفاء',
  render: 'عرض النص',
  copyReply: 'نسخ الرد',
  clear: 'المسح',
};

const $themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
const $layoutSelect = document.getElementById('layout-select') as HTMLSelectElement | null;
const $autostart = document.getElementById('autostart-toggle') as HTMLInputElement | null;
const $status = document.getElementById('status') as HTMLElement | null;

if (!$themeSelect || !$layoutSelect || !$autostart || !$status) {
  throw new Error('settings.ts: missing required DOM elements');
}

const hotkeyInputs = new Map<HotkeyAction, HTMLInputElement>();
for (const action of HOTKEY_ACTIONS) {
  const el = document.querySelector<HTMLInputElement>(`input[data-action="${action}"]`);
  if (el) hotkeyInputs.set(action, el);
}

let statusTimer: number | undefined;
function setStatus(msg: string, kind: 'success' | 'error' | '' = ''): void {
  $status!.textContent = msg;
  $status!.className = 'status-bar' + (kind ? ` is-${kind}` : '');
  if (statusTimer !== undefined) clearTimeout(statusTimer);
  if (msg) {
    statusTimer = window.setTimeout(() => {
      $status!.textContent = '';
      $status!.className = 'status-bar';
    }, 3500);
  }
  // R2-025: success toasts stamp lastSaveAt so a quick Done/Esc close
  // is held long enough for the user to actually see what happened.
  if (kind === 'success') markSaved();
}

function renderForm(prefs: UserPreferences): void {
  $themeSelect!.value = prefs.theme;
  $layoutSelect!.value = prefs.layout;
  $autostart!.checked = prefs.autostart;

  for (const action of HOTKEY_ACTIONS) {
    const input = hotkeyInputs.get(action);
    if (input) input.value = prefs.hotkeys[action];
  }
}

// ─── Initial load ─────────────────────────────────────────────────

async function initialize(): Promise<void> {
  const prefs = await window.api.prefs.get();
  renderForm(prefs);

  window.api.prefs.onUpdated((next) => {
    renderForm(next);
  });
}

void initialize();

// ─── Theme + layout + autostart handlers ─────────────────────────

$themeSelect.addEventListener('change', () => {
  const theme = $themeSelect!.value as Theme;
  void window.api.prefs.set({ theme }).then(() => setStatus('المظهر اتحفظ', 'success'));
});

$layoutSelect.addEventListener('change', () => {
  const layout = $layoutSelect!.value as Layout;
  void window.api.prefs.set({ layout }).then(() => setStatus('التخطيط اتحفظ', 'success'));
});

$autostart.addEventListener('change', async () => {
  const reconciled = await window.api.app.setAutostart($autostart!.checked);
  $autostart!.checked = reconciled;
  setStatus(reconciled ? 'التشغيل التلقائي اتفعّل' : 'التشغيل التلقائي اتعطّل', 'success');
});

// ─── Hotkey rebind ────────────────────────────────────────────────

const MOD_LABEL: Record<string, string> = {
  Control: 'Control',
  Ctrl: 'Control',
  Meta: 'Meta',
  Cmd: 'Meta',
  Alt: 'Alt',
  Shift: 'Shift',
};

function eventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');
  let key = e.key;
  if (key === ' ') key = 'Space';
  // Skip if user only pressed a modifier
  if (key in MOD_LABEL || key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') {
    return null;
  }
  // Normalize single-letter keys to uppercase
  if (key.length === 1) key = key.toUpperCase();
  if (parts.length === 0) return null;
  parts.push(key);
  return parts.join('+');
}

for (const [action, input] of hotkeyInputs) {
  input.addEventListener('focus', () => {
    input.classList.add('is-recording');
    input.classList.remove('is-error');
    // R2-029: stronger recording affordance — emoji dot + clearer instructions.
    // Tooltip explains how to confirm/cancel without leaving the input.
    input.value = '🔴 اضغط الاختصار...';
    input.title = 'اضغط الاختصار · Esc لإلغاء · Tab للخروج';
  });

  input.addEventListener('blur', () => {
    input.classList.remove('is-recording');
    input.removeAttribute('title');
    // Restore actual current binding from prefs on blur without commit
    void window.api.prefs.get().then((prefs) => {
      input.value = prefs.hotkeys[action];
    });
  });

  input.addEventListener('keydown', async (e: KeyboardEvent) => {
    // Allow Tab / Shift+Tab to leave the input naturally (don't trap keyboard
    // users) and Escape to cancel recording.
    if (e.key === 'Tab') {
      input.blur();
      return; // let default Tab navigation proceed
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      input.blur();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const accelerator = eventToAccelerator(e);
    if (accelerator === null) return; // pure modifier — keep recording

    const result = await window.api.hotkeys.setBinding(action, accelerator);
    if (result.ok) {
      input.value = accelerator;
      input.classList.remove('is-error', 'is-recording');
      setStatus(`اختصار ${ACTION_LABELS[action]} اتحدّث`, 'success');
      input.blur();
    } else {
      input.classList.add('is-error');
      // R2-008: refresh the input value to the actual current binding so
      // the user sees the truth (the failed accelerator was rejected and
      // the previous binding is still in effect). Without this, the input
      // sits with the failed string until the user blurs.
      const prefs = await window.api.prefs.get();
      input.value = prefs.hotkeys[action];
      const reasons: Record<string, string> = {
        conflict: 'الاختصار ده محجوز من تطبيق تاني',
        duplicate: 'الاختصار ده مستعمَل لحاجة تانية',
        'invalid-accelerator': 'لازم تستخدم Ctrl أو Alt أو Shift مع حرف',
      };
      setStatus(reasons[result.reason] ?? 'فشل', 'error');
    }
  });
}

// ─── React to hotkey conflicts surfaced at startup ───────────────

window.api.hotkeys.onConflict((action) => {
  const input = hotkeyInputs.get(action);
  if (input) input.classList.add('is-error');
  setStatus(`اختصار ${ACTION_LABELS[action]} محجوز — غيّره من فضلك`, 'error');
});

// ─── Footer: Done + Reset to defaults ───────────────────────────

const $closeBtn = document.getElementById('settings-close') as HTMLButtonElement | null;
const $resetBtn = document.getElementById('settings-reset') as HTMLButtonElement | null;

// R2-025: track when the last save IPC fired so the close path can wait long
// enough for the success toast to actually render. Without this, the user
// clicks a setting and immediately Done — the window dies before the toast.
let lastSaveAt = 0;
function markSaved(): void {
  lastSaveAt = Date.now();
}
function closeWithGrace(): void {
  const elapsed = Date.now() - lastSaveAt;
  const wait = elapsed < 200 ? 200 - elapsed : 0;
  if (wait === 0) {
    window.close();
  } else {
    window.setTimeout(() => window.close(), wait);
  }
}

$closeBtn?.addEventListener('click', closeWithGrace);

// R2-014: Esc closes the settings window (matches OS dialog convention).
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.activeElement?.tagName !== 'INPUT') {
    closeWithGrace();
  }
});

$resetBtn?.addEventListener('click', async () => {
  // eslint-disable-next-line no-alert
  if (!confirm('تأكيد: هترجع كل الإعدادات للافتراضي؟')) return;
  await window.api.prefs.set({
    theme: 'system',
    layout: 'vertical',
    hotkeys: {
      toggle: 'Control+Shift+R',
      render: 'Control+Alt+V',
      copyReply: 'Control+Shift+C',
      clear: 'Control+Shift+X',
    },
  });
  setStatus('اتعملت إعادة تعيين', 'success');
});
