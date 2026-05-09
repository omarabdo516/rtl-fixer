// Electron main entry point. Phase 2 baseline: single-instance lock,
// settings store, IPC handlers, and a placeholder BrowserWindow that proves
// the scaffolding works end to end. Phase 3+ replace the placeholder content
// with the real renderer surfaces (widget / editor / settings / onboarding).

import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSettingsStore } from './services/settingsStore.js';
import { registerIpcHandlers } from './ipc/handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 720,
    height: 600,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Phase 2 keeps sandbox=false to allow ESM imports in preload.
      // Phase 6 (Polish) bundles preload and re-enables sandbox=true.
      sandbox: false,
    },
  });

  // Phase 2 placeholder content. Phase 3 wires the real renderer entries.
  const placeholder = encodeURIComponent(
    `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>RTL Fixer v2 — baseline</title>
     <style>
       html,body{height:100%;margin:0;font-family:system-ui,'Segoe UI',sans-serif}
       body{display:flex;align-items:center;justify-content:center;
            background:rgba(255,255,255,0.96);border-radius:14px;
            box-shadow:0 6px 24px rgba(0,0,0,0.12);padding:2rem;text-align:center}
       h1{font-size:1.4rem;margin:0 0 0.5rem;color:#222}
       p{font-size:0.95rem;color:#555;margin:0.25rem 0}
       code{font-family:ui-monospace,Consolas,monospace;font-size:0.85rem;color:#0a5}
     </style></head><body><div>
     <h1>RTL Fixer v2 — Phase 2 baseline</h1>
     <p>الـ scaffolding شغّال. الـ renderer الفعلي هييجي في Phase 3.</p>
     <p><code>window.api</code> available: <span id="api-status">checking…</span></p>
     <script>
       document.getElementById('api-status').textContent =
         (typeof window.api === 'object' && window.api !== null) ? 'yes ✓' : 'no ✗';
     </script>
     </div></body></html>`,
  );
  win.loadURL(`data:text/html;charset=utf-8,${placeholder}`);

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app
  .whenReady()
  .then(() => {
    const settingsStore = createSettingsStore();
    registerIpcHandlers({ settingsStore });
    mainWindow = createMainWindow();
  })
  .catch((err: unknown) => {
    console.error('[rtl-fixer-v2] Fatal startup error:', err);
    app.exit(1);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
