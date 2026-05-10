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

const HOTKEY_ACTIONS: readonly HotkeyAction[] = ['toggle', 'render', 'copyReply', 'clear'];

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
  void window.api.prefs.set({ theme }).then(() => setStatus('الـ theme اتحفظ', 'success'));
});

$layoutSelect.addEventListener('change', () => {
  const layout = $layoutSelect!.value as Layout;
  void window.api.prefs.set({ layout }).then(() => setStatus('التخطيط اتحفظ', 'success'));
});

$autostart.addEventListener('change', async () => {
  const reconciled = await window.api.app.setAutostart($autostart!.checked);
  $autostart!.checked = reconciled;
  setStatus(reconciled ? 'الـ autostart اتفعّل' : 'الـ autostart اتعطّل', 'success');
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
    input.value = 'اضغط الـ combo...';
  });

  input.addEventListener('blur', () => {
    input.classList.remove('is-recording');
    // Restore actual current binding from prefs on blur without commit
    void window.api.prefs.get().then((prefs) => {
      input.value = prefs.hotkeys[action];
    });
  });

  input.addEventListener('keydown', async (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const accelerator = eventToAccelerator(e);
    if (accelerator === null) return; // pure modifier — keep recording

    const result = await window.api.hotkeys.setBinding(action, accelerator);
    if (result.ok) {
      input.value = accelerator;
      input.classList.remove('is-error', 'is-recording');
      setStatus(`الـ hotkey لـ "${action}" اتحدّث`, 'success');
      input.blur();
    } else {
      input.classList.add('is-error');
      const reasons: Record<string, string> = {
        conflict: 'الـ combo ده محجوز من تطبيق تاني',
        duplicate: 'الـ combo ده مستخدم في action تاني',
        'invalid-accelerator': 'الـ combo لازم يحتوي modifier + key',
      };
      setStatus(reasons[result.reason] ?? 'فشل', 'error');
    }
  });
}

// ─── React to hotkey conflicts surfaced at startup ───────────────

window.api.hotkeys.onConflict((action) => {
  const input = hotkeyInputs.get(action);
  if (input) input.classList.add('is-error');
  setStatus(`الـ hotkey "${action}" محجوز — غيّر الـ combo`, 'error');
});
