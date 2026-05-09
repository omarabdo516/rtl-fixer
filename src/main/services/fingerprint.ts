// SHA-256 fingerprint helper. Main-process only (uses Node's crypto module).
// Located here (not src/shared/) because the renderer never needs it directly —
// all clipboard writes go through main-process IPC handlers that fingerprint
// before the OS clipboard hit.

import { createHash } from 'node:crypto';

const FINGERPRINT_LENGTH = 16;

export function fingerprint(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, FINGERPRINT_LENGTH);
}
