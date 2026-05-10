// Shared theme initializer — sets data-theme="light"|"dark" on <html> based
// on the resolved OS theme (or user override). Called once per renderer
// entry. Safe to call before window.api is ready (it short-circuits if so).

export function initTheme(): void {
  if (!window.api?.theme) return;

  const apply = (resolved: 'light' | 'dark'): void => {
    document.documentElement.dataset.theme = resolved;
  };

  void window.api.theme.getResolvedTheme().then(apply);
  window.api.theme.onResolvedThemeChanged(apply);
}
