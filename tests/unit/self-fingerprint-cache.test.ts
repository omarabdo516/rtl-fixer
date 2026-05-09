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
    const cache = createSelfFingerprintCache(3);
    cache.add('a');
    cache.add('b');
    cache.add('c');
    cache.add('d'); // 'a' evicted
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  it('add is idempotent for the same fingerprint', () => {
    const cache = createSelfFingerprintCache(3);
    cache.add('a');
    cache.add('a');
    cache.add('a');
    expect(cache.size()).toBe(1);
  });

  it('default capacity of 8 retains the last 8 unique entries', () => {
    const cache = createSelfFingerprintCache();
    for (let i = 0; i < 10; i++) {
      cache.add(`fp${i}`);
    }
    expect(cache.has('fp0')).toBe(false);
    expect(cache.has('fp1')).toBe(false);
    expect(cache.has('fp2')).toBe(true);
    expect(cache.has('fp9')).toBe(true);
    expect(cache.size()).toBe(8);
  });

  it('size never exceeds capacity', () => {
    const cache = createSelfFingerprintCache(3);
    for (let i = 0; i < 100; i++) {
      cache.add(`fp${i}`);
    }
    expect(cache.size()).toBe(3);
  });
});
