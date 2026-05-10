// TTL-bounded FIFO cache of recently self-written clipboard fingerprints.
// Used by the clipboard watcher to ignore self-originated content while
// avoiding two failure modes of the previous fixed-size buffer:
//   1) capacity 8 was too small — rapid copy bursts evicted legitimate
//      self-writes within seconds, letting them re-fire as "external".
//   2) no expiry — a stale self-write fingerprint could still match an
//      identical external paste minutes later, silently dropping it.
//
// Design: bounded by both capacity (32) and TTL (30s). Entries past TTL
// are filtered on read; oldest entries are evicted when over capacity.

export interface SelfFingerprintCache {
  add(fingerprint: string): void;
  has(fingerprint: string): boolean;
  size(): number;
}

export interface SelfFingerprintCacheOptions {
  capacity?: number;
  ttlMs?: number;
  /** Injected for tests so we can advance "now" deterministically. */
  now?: () => number;
}

interface Entry {
  fp: string;
  addedAt: number;
}

export function createSelfFingerprintCache(
  opts: SelfFingerprintCacheOptions = {},
): SelfFingerprintCache {
  const capacity = opts.capacity ?? 32;
  const ttlMs = opts.ttlMs ?? 30_000;
  const now = opts.now ?? Date.now;

  let entries: Entry[] = [];

  function pruneExpired(): void {
    const cutoff = now() - ttlMs;
    if (entries.length === 0 || entries[0]!.addedAt >= cutoff) return;
    entries = entries.filter((e) => e.addedAt >= cutoff);
  }

  return {
    add(fp: string): void {
      pruneExpired();
      const existing = entries.findIndex((e) => e.fp === fp);
      if (existing !== -1) {
        // Refresh the timestamp on re-add so a recently-touched entry
        // stays valid for a fresh TTL window.
        entries[existing]!.addedAt = now();
        return;
      }
      entries.push({ fp, addedAt: now() });
      while (entries.length > capacity) {
        entries.shift();
      }
    },
    has(fp: string): boolean {
      pruneExpired();
      return entries.some((e) => e.fp === fp);
    },
    size(): number {
      pruneExpired();
      return entries.length;
    },
  };
}
