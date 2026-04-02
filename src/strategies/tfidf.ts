/**
 * @file TF-IDF based sentiment classifier.
 *
 * Accepts pre-tokenized word array and a sentiment lexicon.
 * Builds TF-IDF vectors and compares cosine similarity against
 * positive/negative reference vectors derived from the lexicon.
 */

import type { SentimentResult, SentimentLabel, SentimentLexicon } from "../types";

// ============================================================
// Constants
// ============================================================

const DEFAULT_NEUTRAL_THRESHOLD = 0.05;

// ============================================================
// Internal helpers
// ============================================================

function buildTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
}

function vectorNorm(vector: Map<string, number>): number {
  const sumOfSquares = Array.from(vector.values()).reduce((acc, v) => acc + v * v, 0);
  return Math.sqrt(sumOfSquares);
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  const dot = Array.from(small).reduce((acc, [key, value]) => acc + value * (large.get(key) ?? 0), 0);

  const normA = vectorNorm(a);
  const normB = vectorNorm(b);
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (normA * normB);
}

function buildReferenceVectors(lexicon: SentimentLexicon): {
  positiveRef: Map<string, number>;
  negativeRef: Map<string, number>;
} {
  const positiveRef = new Map<string, number>();
  const negativeRef = new Map<string, number>();

  for (const [word, score] of lexicon.entries) {
    if (score > 0) {
      positiveRef.set(word, score);
    } else if (score < 0) {
      negativeRef.set(word, Math.abs(score));
    }
  }

  return { positiveRef, negativeRef };
}

function classifyFromSimilarity(
  posSim: number,
  negSim: number,
  total: number,
  diff: number,
  neutralThreshold: number
): { label: SentimentLabel; confidence: number } {
  if (total === 0 || Math.abs(diff) < neutralThreshold) {
    return { label: "neutral", confidence: total === 0 ? 1.0 : 1.0 - total };
  }
  if (diff > 0) {
    return { label: "positive", confidence: total > 0 ? posSim / total : 0.5 };
  }
  return { label: "negative", confidence: total > 0 ? negSim / total : 0.5 };
}

function normalizeScores(posSim: number, negSim: number, total: number): Record<SentimentLabel, number> {
  const neutralScore = Math.max(0, 1.0 - total);
  const scoreTotal = posSim + negSim + neutralScore;
  if (scoreTotal <= 0) {
    return { positive: 0, negative: 0, neutral: 1 };
  }
  return {
    positive: posSim / scoreTotal,
    negative: negSim / scoreTotal,
    neutral: neutralScore / scoreTotal,
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Classify tokens using TF-IDF cosine similarity.
 *
 * @param tokens - Pre-tokenized words (from tokenizeText)
 * @param lexicon - Sentiment lexicon
 * @param neutralThreshold - Threshold for neutral classification (default: 0.05)
 */
export function classifyByTfidf(
  tokens: string[],
  lexicon: SentimentLexicon,
  neutralThreshold: number = DEFAULT_NEUTRAL_THRESHOLD
): SentimentResult {
  if (tokens.length === 0) {
    return { label: "neutral", confidence: 1.0, scores: { positive: 0, negative: 0, neutral: 1 } };
  }

  const { positiveRef, negativeRef } = buildReferenceVectors(lexicon);
  const rawTf = buildTermFrequency(tokens);
  const textVector = new Map<string, number>();
  for (const [term, count] of rawTf) {
    textVector.set(term, count / tokens.length);
  }

  const posSim = cosineSimilarity(textVector, positiveRef);
  const negSim = cosineSimilarity(textVector, negativeRef);

  const total = posSim + negSim;
  const diff = posSim - negSim;

  const { label, confidence } = classifyFromSimilarity(posSim, negSim, total, diff, neutralThreshold);
  const scores = normalizeScores(posSim, negSim, total);

  return { label, confidence, scores };
}
