// Migrated from v1 _tools/rtl-fixer/index.html.
// Behavior is preserved verbatim except:
//   - marked is imported from the bundled package, not CDN
//   - clipboard writes go through window.api.clipboard.* so the main-process
//     fingerprint cache is updated atomically before the OS clipboard hit
//   - subscribes to window.api.clipboard.onArabicDetected to auto-fill from
//     external clipboard events

import { marked } from 'marked';
import DOMPurify from 'dompurify';

const $app = document.querySelector<HTMLElement>('.app');
const $input = document.getElementById('input') as HTMLTextAreaElement | null;
const $output = document.getElementById('output');
const $reply = document.getElementById('reply') as HTMLTextAreaElement | null;
const $copyOutput = document.getElementById('copy-output') as HTMLButtonElement | null;
const $copyReply = document.getElementById('copy-reply') as HTMLButtonElement | null;
const $clearInput = document.getElementById('clear-input') as HTMLButtonElement | null;
const $clearReply = document.getElementById('clear-reply') as HTMLButtonElement | null;
const $status = document.getElementById('status');
const $layoutOpts = document.querySelectorAll<HTMLButtonElement>('.layout-opt');

if (!$app || !$input || !$output || !$reply || !$copyOutput || !$copyReply || !$clearInput || !$clearReply || !$status) {
  throw new Error('editor.ts: missing required DOM elements');
}

marked.setOptions({ breaks: true, gfm: true });

// R2-002: clipboard content can include malicious HTML/script. Even though
// nodeIntegration is off and contextIsolation is on, an injected script in
// the renderer can still call window.api.* (the only exposed surface) and
// could exfiltrate clipboard content the user is about to paste. Sanitize
// every parse result before assigning to innerHTML.
function safeRender(markdown: string): string {
  const parsed = marked.parse(markdown) as string;
  return DOMPurify.sanitize(parsed, {
    // Allow code blocks + tables but no event handlers, no <script>, no
    // <iframe>, no <object>. DOMPurify's default profile already strips
    // these; the explicit hooks below are paranoid for clarity.
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  });
}

function render(): void {
  const text = $input!.value;
  // Subtle in-progress hint so the user sees something happen on heavy
  // pastes (the parse + DOM swap can hitch on multi-KB markdown blobs).
  $output!.classList.add('is-loading');
  requestAnimationFrame(() => {
    if (!text.trim()) {
      $output!.innerHTML = '';
    } else {
      $output!.innerHTML = safeRender(text);
      $output!.scrollTop = 0;
    }
    $output!.classList.remove('is-loading');
    updateButtons();
  });
}

function updateButtons(): void {
  $copyOutput!.disabled = !$output!.textContent?.trim();
  $copyReply!.disabled = !$reply!.value.trim();
}

let statusTimer: number | undefined;
function setStatus(msg: string, type: '' | 'success' = ''): void {
  $status!.textContent = msg;
  $status!.className = 'status-bar' + (type ? ' ' + type : '');
  if (statusTimer !== undefined) clearTimeout(statusTimer);
  if (msg) {
    // R2-021: 4000ms was leaving toasts overlapping when the user copied
    // twice in quick succession. 2800ms matches v1 + perceived snappiness.
    statusTimer = window.setTimeout(() => {
      $status!.textContent = '';
      $status!.className = 'status-bar';
    }, 2800);
  }
}

async function copyOutput(): Promise<void> {
  const text = $output!.textContent?.trim() ?? '';
  if (!text) return;
  try {
    await window.api.clipboard.writeFormatted($output!.innerHTML, text);
    setStatus('اتنسخ منسق — الصقه في Word / Notion / Gmail', 'success');
  } catch {
    setStatus('النسخ ما تمّش — جرّب تاني');
  }
}

async function copyReply(): Promise<void> {
  const text = $reply!.value.trim();
  if (!text) return;
  try {
    await window.api.clipboard.writeReply(text);
    setStatus('الرد اتنسخ — الصقه في Claude Code', 'success');
  } catch {
    setStatus('النسخ ما تمّش — جرّب تاني');
  }
}

// F-024 + F-037: layout is a radiogroup (aria-checked) and the source of
// truth is window.api.prefs (not localStorage), so the editor and the
// Settings panel stay in sync.
function applyLayoutVisual(layout: 'vertical' | 'horizontal'): void {
  $app!.dataset.layout = layout;
  $layoutOpts.forEach((opt) => {
    opt.setAttribute('aria-checked', opt.dataset.layout === layout ? 'true' : 'false');
  });
}

function selectLayout(rawLayout: string | null): void {
  const layout = rawLayout === 'horizontal' ? 'horizontal' : 'vertical';
  applyLayoutVisual(layout);
  void window.api.prefs.set({ layout });
}

$layoutOpts.forEach((opt) => {
  opt.addEventListener('click', () => selectLayout(opt.dataset.layout ?? 'vertical'));
});

// React to prefs changes from elsewhere (e.g. Settings panel)
window.api.prefs.onUpdated((next) => {
  if (next.layout !== $app!.dataset.layout) {
    applyLayoutVisual(next.layout);
  }
});

$input.addEventListener('input', render);
$input.addEventListener('paste', () => setTimeout(render, 0));
$reply.addEventListener('input', updateButtons);

$clearInput.addEventListener('click', () => {
  $input!.value = '';
  $output!.innerHTML = '';
  $input!.focus();
  updateButtons();
  setStatus('اتمسح', 'success');
});
$clearReply.addEventListener('click', () => {
  $reply!.value = '';
  $reply!.focus();
  updateButtons();
  setStatus('الرد اتمسح', 'success');
});

$copyOutput.addEventListener('click', () => void copyOutput());
$copyReply.addEventListener('click', () => void copyReply());

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    void copyReply();
  }
});

// Subscribe to clipboard events forwarded by the main process. External
// Arabic content auto-fills the input area and triggers a render.
if (window.api?.clipboard?.onArabicDetected) {
  window.api.clipboard.onArabicDetected((event) => {
    $input!.value = event.text;
    render();
  });
}

// Initial layout from prefs (single source of truth)
void window.api.prefs.get().then((prefs) => {
  applyLayoutVisual(prefs.layout);
});
updateButtons();

// R2-027: render the Copy-reply shortcut glyph based on the actual host
// platform. Windows/Linux see "Ctrl+Enter"; macOS sees "⌘↵". The HTML
// markup ships with the macOS glyph so screen readers always have valid
// text — JS just rewrites for non-mac.
{
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const $kbd = $copyReply!.querySelector('kbd.kbd');
  if ($kbd) {
    $kbd.textContent = isMac ? '⌘↵' : 'Ctrl+Enter';
  }
}
