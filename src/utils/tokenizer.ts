/**
 * @file Tokenizer for multilingual sentiment analysis.
 *
 * For Japanese: uses mikan-style character-class segmentation to produce
 * word-level tokens. This structurally prevents Scunthorpe-class false
 * positives (katakana compounds are never split into substrings).
 *
 * For English/other: uses whitespace-based word tokenization.
 *
 * Both paths produce lowercased tokens stripped of punctuation.
 */

import { segmentText } from "./segmenter";

// ============================================================
// Constants
// ============================================================

const RE_PUNCT_ONLY = /^[\p{P}\p{S}\s]+$/u;

// ============================================================
// Public API
// ============================================================

/**
 * Tokenize text into word-level tokens suitable for sentiment analysis.
 *
 * @param text - Text to tokenize
 * @param language - Language code ("ja", "en", etc.)
 * @returns Array of lowercased word tokens
 */
export function tokenizeText(text: string, language: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const segments = segmentText(normalized, language);

  return segments
    .map((s) => stripPunctuation(s).toLowerCase())
    .filter((s) => s.length > 0 && !RE_PUNCT_ONLY.test(s));
}

// ============================================================
// Internal helpers
// ============================================================

/** Strip leading/trailing punctuation from a token */
function stripPunctuation(token: string): string {
  return token.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "");
}
