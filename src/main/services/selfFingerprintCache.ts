// FIFO ring buffer of recently-self-written clipboard fingerprints.
// Used by the clipboard watcher to ignore self-originated content.

export interface SelfFingerprintCache {
  add(fingerprint: string): void;
  has(fingerprint: string): boolean;
  size(): number;
}

export function createSelfFingerprintCache(capacity = 8): SelfFingerprintCache {
  const buffer: string[] = [];

  return {
    add(fp: string): void {
      const existingIndex = buffer.indexOf(fp);
      if (existingIndex !== -1) return; // idempotent
      buffer.push(fp);
      if (buffer.length > capacity) {
        buffer.shift();
      }
    },
    has(fp: string): boolean {
      return buffer.includes(fp);
    },
    size(): number {
      return buffer.length;
    },
  };
}
