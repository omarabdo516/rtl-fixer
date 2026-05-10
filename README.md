# RTL Fixer

Floating, Grammarly-style overlay for **rendering Arabic text** that comes out mangled in Windows terminals (Claude Code, PowerShell, cmd). Watches your clipboard, auto-renders Arabic content in a small always-on-top widget, and copies your typed reply back ready to paste.

> Built for marketers and content folks who collaborate with AI assistants in Arabic and don't want to fight the terminal's broken right-to-left rendering every time.

## What it does

1. **Auto-render on copy** — copy any Arabic text from any app; the widget renders it readable in <1 second.
2. **Reply in-place** — type your response in the widget with proper RTL direction; one click copies it back to the clipboard, ready to paste into the terminal.
3. **Stays out of the way** — collapses into a 60×60 circle in the corner, expands when you click it, fades when idle.
4. **Keyboard accelerators** — `Ctrl+Shift+R` toggle, `Ctrl+Shift+V` re-render last clipboard, `Ctrl+Shift+C` copy reply, `Ctrl+Shift+X` clear.

## Quickstart (development)

Requires **Node.js 20+** and **pnpm 9+** on Windows.

```powershell
git clone https://github.com/omarabdo516/rtl-fixer.git
cd rtl-fixer
pnpm install
pnpm dev
```

The Electron window opens with an onboarding tour the first time. Skip or follow it; you'll land on a small bubble in the bottom-right of your primary screen.

## Build a portable .exe

```powershell
pnpm build
# Output: dist/release/RTLFixer-v2.exe (~150MB, single file, no installer)
```

The `.exe` is **unsigned** — Windows SmartScreen will warn the first time. Click "More info" → "Run anyway".

## Tech

- **Electron 33+** (TypeScript) — frameless transparent always-on-top window
- **Vite** (renderer) — multi-entry HTML for widget / editor / settings / onboarding
- **marked** — Markdown rendering
- **electron-store** — typed JSON settings persistence
- **vitest** + **@playwright/test** (Electron driver) — unit + E2E tests

## Project layout

```
src/
├── main/                 # Electron main process
│   ├── services/         # clipboard watcher, hotkey manager, settings store, autostart, tray
│   ├── windows/          # widget (3-mode) + settings windows
│   └── ipc/handlers.ts   # typed channel registry
├── preload/preload.ts    # contextBridge → window.api
├── renderer/             # browser context (UI)
│   ├── widget/           # the floating shell (collapsed / notification / expanded)
│   ├── editor/           # 3-section paste/render/reply editor
│   ├── settings/         # rebindable hotkeys, theme, autostart
│   └── onboarding/       # first-launch tour
└── shared/               # types + IPC channel constants used by both main & renderer

tests/
├── unit/                 # vitest — Arabic detection, fingerprint cache, settings schema, hotkey validation, widget position helpers
└── e2e/                  # @playwright/test — clipboard flow, widget modes, hotkeys, settings, autostart
```

## Status

- [x] User Story 1 — Clipboard auto-render (MVP)
- [x] User Story 2 — Polished floating widget (3 modes, drag, snap, fade, multi-monitor)
- [x] User Story 3 — Global hotkeys, settings panel, onboarding, autostart
- [x] Full UI/UX audit fixes (37 issues across a11y, RTL, microcopy, polish)
- [ ] Phase 6 — security hardening, perf benchmarks, code-signing, portable build polish

79 / 79 tests pass (56 unit + 23 E2E).

## Why open source

This started as a private workflow utility — I copied Arabic from Claude Code into a HTML page in my browser and pasted back. It works for any Arabic+terminal workflow, not just mine. Sharing in case it helps someone else. PRs and issues welcome.

## License

[MIT](./LICENSE)
