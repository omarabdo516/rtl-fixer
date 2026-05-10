import { describe, it, expect } from 'vitest';
import { createSelfFingerprintCache } from '../../src/main/services/selfFingerprintCache.js';

describe('selfFingerprintCache', () => {
  it('starts empty', () => {
    const cache = createSelfFingerprintCache();
    expect(cache.size()).toBe(0);
    expect(cache.has('abc')).toBe(false);
  });

  it('add then has returns true for that fingerprint', () => {
    const cache = createSelfFingerprintCache();
    cache.add('abc123');
    expect(cache.has('abc123')).toBe(true);
  });

  it('does not match a fingerprint that was never added', () => {
    const cache = createSelfFingerprintCache();
    cache.add('abc123');
    expect(cache.has('zzz999')).toBe(false);
  });

  it('evicts oldest entry FIFO when capacity exceeded', () => {
    const cache = createSelfFingerprintCache({ capacity: 3 });
    cache.add('a');
    cache.add('b');
    cache.add('c');
    cache.add('d'); // 'a' evicted
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  it('add refreshes timestamp on re-add (idempotent on identity, fresh TTL)', () => {
    let now = 1_000_000;
    const cache = createSelfFingerprintCache({ capacity: 3, ttlMs: 1000, now: () => now });
    cache.add('a');
    expect(cache.size()).toBe(1);
    now += 500;
    cache.add('a'); // refreshes timestamp
    expect(cache.size()).toBe(1);
    now += 800; // 1300ms past initial add but only 800ms past refresh
    expect(cache.has('a')).toBe(true); // still alive thanks to refresh
  });

  it('default capacity of 32 retains the last 32 unique entries', () => {
    const cache = createSelfFingerprintCache();
    for (let i = 0; i < 40; i++) {
      cache.add(`fp${i}`);
    }
    expect(cache.has('fp7')).toBe(false);
    expect(cache.has('fp8')).toBe(true);
    expect(cache.has('fp39')).toBe(true);
    expect(cache.size()).toBe(32);
  });

  it('size never exceeds capacity', () => {
    const cache = createSelfFingerprintCache({ capacity: 3 });
    for (let i = 0; i < 100; i++) {
      cache.add(`fp${i}`);
    }
    expect(cache.size()).toBe(3);
  });

  it('TTL expires entries after the configured window', () => {
    let now = 1_000_000;
    const cache = createSelfFingerprintCache({ capacity: 10, ttlMs: 5_000, now: () => now });
    cache.add('a');
    cache.add('b');
    expect(cache.has('a')).toBe(true);
    now += 4_999;
    expect(cache.has('a')).toBe(true); // still within TTL
    now += 2; // 5_001ms total
    expect(cache.has('a')).toBe(false); // expired
    expect(cache.has('b')).toBe(false); // expired (added at same time)
  });

  it('TTL prunes on size() too', () => {
    let now = 1_000_000;
    const cache = createSelfFingerprintCache({ capacity: 10, ttlMs: 1000, now: () => now });
    cache.add('a');
    cache.add('b');
    expect(cache.size()).toBe(2);
    now += 1500;
    expect(cache.size()).toBe(0);
  });

  it('default TTL is 30 seconds', () => {
    let now = 1_000_000;
    const cache = createSelfFingerprintCache({ now: () => now });
    cache.add('a');
    now += 29_999;
    expect(cache.has('a')).toBe(true);
    now += 2;
    expect(cache.has('a')).toBe(false);
  });
});
