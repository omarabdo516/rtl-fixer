import { describe, it, expect } from 'vitest';
import { fingerprint } from '../../src/main/services/fingerprint.js';

describe('fingerprint', () => {
  it('returns 16 hex characters', () => {
    const fp = fingerprint('hello');
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for the same input', () => {
    const a = fingerprint('the quick brown fox jumps over the lazy dog');
    const b = fingerprint('the quick brown fox jumps over the lazy dog');
    expect(a).toBe(b);
  });

  it('returns different fingerprints for different inputs', () => {
    expect(fingerprint('a')).not.toBe(fingerprint('b'));
    expect(fingerprint('hello')).not.toBe(fingerprint('Hello'));
    expect(fingerprint('hello ')).not.toBe(fingerprint('hello'));
  });

  it('handles empty string', () => {
    const fp = fingerprint('');
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('handles Arabic text', () => {
    const a = fingerprint('السلام عليكم');
    const b = fingerprint('السلام عليكم');
    expect(a).toBe(b);
    expect(a).not.toBe(fingerprint('Hello'));
  });

  it('handles very long input', () => {
    const huge = 'x'.repeat(1_000_000);
    const fp = fingerprint(huge);
    expect(fp).toHaveLength(16);
  });

  it('returns lowercase hex', () => {
    const fp = fingerprint('TEST');
    expect(fp).toBe(fp.toLowerCase());
  });
});
