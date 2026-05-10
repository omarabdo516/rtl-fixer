// Windows auto-start at login. Uses Electron's app.setLoginItemSettings
// which writes to HKCU\Software\Microsoft\Windows\CurrentVersion\Run.
// The actual registry value stores the absolute path of the launched
// executable, so portable .exe locations are preserved across runs.

import { app } from 'electron';

export interface AutostartManager {
  isEnabled(): boolean;
  setEnabled(enabled: boolean): boolean;
}

export function createAutostartManager(): AutostartManager {
  return {
    isEnabled(): boolean {
      return app.getLoginItemSettings().openAtLogin;
    },
    setEnabled(enabled: boolean): boolean {
      app.setLoginItemSettings({ openAtLogin: enabled });
      // Read back to reconcile in case the OS rejected (rare; e.g.
      // policy-locked machines).
      return app.getLoginItemSettings().openAtLogin;
    },
  };
}
