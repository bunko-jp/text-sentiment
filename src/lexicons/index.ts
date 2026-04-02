/**
 * @file Unified lexicon registry.
 *
 * Lexicons + NB models are registered from binary data.
 * No fs dependency — works in both Node/Bun and browser.
 */

import { decodeSentimentData, decodeToxicData } from "../utils/data-codec";
import type { SentimentLexicon, NaiveBayesModel, ToxicLexicon } from "../types";

// ============================================================
// Caches
// ============================================================

const sentimentCache = new Map<string, SentimentLexicon>();
const nbModelCache = new Map<string, NaiveBayesModel>();
const toxicCache = new Map<string, ToxicLexicon>();

// ============================================================
// Registration
// ============================================================

/** Register sentiment lexicon (+ NB model if present) from compressed binary. */
export function registerLexiconFromBinary(language: string, data: Uint8Array): void {
  const { lexicon, nbModel } = decodeSentimentData(data);
  sentimentCache.set(language, lexicon);
  if (nbModel) {
    nbModelCache.set(language, nbModel);
  }
}

/** Register a toxic lexicon from compressed binary data. */
export function registerToxicLexiconFromBinary(language: string, data: Uint8Array): void {
  toxicCache.set(language, decodeToxicData(data));
}

/** Register a pre-decoded sentiment lexicon directly. */
export function registerLexicon(language: string, lexicon: SentimentLexicon): void {
  sentimentCache.set(language, lexicon);
}

/** Register a pre-trained NB model directly. */
export function registerNbModel(language: string, model: NaiveBayesModel): void {
  nbModelCache.set(language, model);
}

/** Register a pre-decoded toxic lexicon directly. */
export function registerToxicLexicon(language: string, lexicon: ToxicLexicon): void {
  toxicCache.set(language, lexicon);
}

// ============================================================
// Getters
// ============================================================

/** Get the sentiment lexicon for a language. */
export function getLexicon(language: string): SentimentLexicon {
  const cached = sentimentCache.get(language);
  if (cached) {
    return cached;
  }
  throw new Error(`No sentiment lexicon registered for "${language}". Call registerLexiconFromBinary() first.`);
}

/** Get the pre-trained NB model for a language (undefined if not available). */
export function getNbModel(language: string): NaiveBayesModel | undefined {
  return nbModelCache.get(language);
}

/** Get the toxic word lexicon for a language. */
export function getToxicLexicon(language: string): ToxicLexicon {
  const cached = toxicCache.get(language);
  if (cached) {
    return cached;
  }
  throw new Error(`No toxic lexicon registered for "${language}". Call registerToxicLexiconFromBinary() first.`);
}

/** List registered sentiment lexicon languages. */
export function supportedLanguages(): string[] {
  return [...sentimentCache.keys()];
}

// ============================================================
// Utility
// ============================================================

/** Compute a raw lexicon score by summing matched word scores. */
export function scoreLexicon(tokens: string[], lexicon: SentimentLexicon): { sum: number; count: number } {
  return tokens.reduce(
    (acc, token) => {
      const score = lexicon.entries.get(token);
      if (score !== undefined) {
        return { sum: acc.sum + score, count: acc.count + 1 };
      }
      return acc;
    },
    { sum: 0, count: 0 }
  );
}
