// Hosts the renderer is allowed to open via window.api.app.openExternal.
// Centralized so adding a new external link target is a single-file change
// and audits can read the full allow-list in one place.
//
// Add a host here only after confirming it's a domain the user controls or
// reasonably trusts (project repo, brand site, etc.). Anything else should
// stay rejected with INVALID_URL.

export const ALLOWED_EXTERNAL_URL_HOSTS: ReadonlySet<string> = new Set([
  'github.com',
  'rspaac.com',
  'growthmora.com',
]);
