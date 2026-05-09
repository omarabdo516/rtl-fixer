// Arabic detection helper. Pure function, used by both main (clipboard watcher)
// and renderer (defensive re-checks). No I/O, no Node-specific APIs.

import type { ArabicDetectionResult } from './types.js';

// Unicode range U+0600..U+06FF — the standard Arabic block. Extended ranges
// (Supplement U+0750..U+077F, Presentation Forms U+FB50..U+FEFC) are out of
// scope for v2 per spec assumptions.
const ARABIC_RANGE = /[؀-ۿ]/g;

// Hard cap to avoid pathological regex behavior on huge clipboard pastes.
// Above this size the watcher reports "no Arabic" without scanning.
const SAFE_INPUT_LIMIT = 5_000_000;

export function detectArabic(text: string): ArabicDetectionResult {
  const totalCharCount = text.length;

  if (totalCharCount > SAFE_INPUT_LIMIT) {
    return {
      containsArabic: false,
      arabicCharCount: 0,
      totalCharCount,
    };
  }

  const matches = text.match(ARABIC_RANGE);
  return {
    containsArabic: matches !== null && matches.length > 0,
    arabicCharCount: matches?.length ?? 0,
    totalCharCount,
  };
}
