import { describe, it, expect } from 'vitest';
import { detectArabic } from '../../src/shared/arabic.js';

describe('detectArabic', () => {
  it('detects pure Arabic text', () => {
    const result = detectArabic('السلام عليكم ورحمة الله وبركاته');
    expect(result.containsArabic).toBe(true);
    expect(result.arabicCharCount).toBeGreaterThan(0);
  });

  it('detects mixed Arabic and English', () => {
    const result = detectArabic('Hello مرحبا World');
    expect(result.containsArabic).toBe(true);
    expect(result.arabicCharCount).toBe(5); // مرحبا
  });

  it('returns false for pure English', () => {
    const result = detectArabic('The quick brown fox jumps over the lazy dog');
    expect(result.containsArabic).toBe(false);
    expect(result.arabicCharCount).toBe(0);
  });

  it('returns false for empty string', () => {
    const result = detectArabic('');
    expect(result.containsArabic).toBe(false);
    expect(result.arabicCharCount).toBe(0);
    expect(result.totalCharCount).toBe(0);
  });

  it('returns false for whitespace only', () => {
    const result = detectArabic('   \n\t  ');
    expect(result.containsArabic).toBe(false);
  });

  it('handles 6MB pathological input by short-circuiting', () => {
    const huge = 'a'.repeat(6_000_000);
    const start = Date.now();
    const result = detectArabic(huge);
    const elapsed = Date.now() - start;
    expect(result.containsArabic).toBe(false);
    expect(result.totalCharCount).toBe(6_000_000);
    // Should NOT scan: short-circuits in <50ms even though length is huge.
    expect(elapsed).toBeLessThan(100);
  });

  it('detects common Arabic punctuation', () => {
    expect(detectArabic('؟').containsArabic).toBe(true); // Arabic question mark
    expect(detectArabic('،').containsArabic).toBe(true); // Arabic comma
    expect(detectArabic('؛').containsArabic).toBe(true); // Arabic semicolon
  });

  it('detects Arabic-Indic digits', () => {
    expect(detectArabic('١٢٣٤٥').containsArabic).toBe(true);
  });

  it('reports correct totalCharCount', () => {
    expect(detectArabic('hello').totalCharCount).toBe(5);
    expect(detectArabic('').totalCharCount).toBe(0);
    expect(detectArabic('  ').totalCharCount).toBe(2);
    expect(detectArabic('السلام').totalCharCount).toBe(6);
  });

  it('counts only Arabic-block characters in arabicCharCount', () => {
    const result = detectArabic('AB مرحبا CD');
    expect(result.arabicCharCount).toBe(5);
    expect(result.totalCharCount).toBe(11);
  });
});
