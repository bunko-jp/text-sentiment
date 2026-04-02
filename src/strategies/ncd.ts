/**
 * @file NCD-based sentiment classifier.
 *
 * Accepts pre-tokenized word array and a sentiment lexicon.
 * Joins tokens into text, then measures Normalized Compression Distance
 * against positive/negative reference corpora built from the lexicon.
 */

import { deflateSync } from "fflate";
import type { SentimentResult, SentimentLabel, SentimentLexicon } from "../types";

// ============================================================
// Constants
// ============================================================

const DEFAULT_NEUTRAL_THRESHOLD = 0.005;
const encoder = new TextEncoder();

// ============================================================
// Compression helpers
// ============================================================

function compressedSize(text: string): number {
  return deflateSync(encoder.encode(text)).length;
}

function ncd(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) {
    return 0;
  }
  if (a.length === 0 || b.length === 0) {
    return 1;
  }

  const cA = compressedSize(a);
  const cB = compressedSize(b);
  const cAB = compressedSize(a + b);
  const minC = Math.min(cA, cB);
  const maxC = Math.max(cA, cB);

  return maxC === 0 ? 0 : (cAB - minC) / maxC;
}

function buildReferenceCorpora(lexicon: SentimentLexicon): { positiveCorpus: string; negativeCorpus: string } {
  const positiveWords: string[] = [];
  const negativeWords: string[] = [];

  for (const [word, score] of lexicon.entries) {
    const repeats = Math.max(1, Math.ceil(Math.abs(score) * 3));
    if (score > 0.1) {
      positiveWords.push(...Array<string>(repeats).fill(word));
    } else if (score < -0.1) {
      negativeWords.push(...Array<string>(repeats).fill(word));
    }
  }

  return {
    positiveCorpus: positiveWords.join(" "),
    negativeCorpus: negativeWords.join(" "),
  };
}

function classifyByDiff(
  posSim: number,
  negSim: number,
  diff: number,
  neutralThreshold: number
): { label: SentimentLabel; confidence: number } {
  if (Math.abs(diff) < neutralThreshold) {
    const total = posSim + negSim;
    return { label: "neutral", confidence: total > 0 ? 1 - Math.abs(diff) / total : 1.0 };
  }
  if (diff > 0) {
    return { label: "positive", confidence: posSim / (posSim + negSim) };
  }
  return { label: "negative", confidence: negSim / (posSim + negSim) };
}

function buildNormalizedScores(posSim: number, negSim: number): Record<SentimentLabel, number> {
  const neutralScore = Math.max(0, 1 - (posSim + negSim));
  const total = posSim + negSim + neutralScore;
  if (total <= 0) {
    return { positive: 0, negative: 0, neutral: 1 };
  }
  return {
    positive: posSim / total,
    negative: negSim / total,
    neutral: neutralScore / total,
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Classify tokens using NCD against sentiment reference corpora.
 *
 * Tokens are joined into a single string for compression comparison.
 * This ensures the same tokenization SoT as other strategies.
 *
 * @param tokens - Pre-tokenized words (from tokenizeText)
 * @param lexicon - Sentiment lexicon (used to build reference corpora)
 * @param neutralThreshold - Threshold for neutral classification (default: 0.005)
 */
export function classifyByNcd(
  tokens: string[],
  lexicon: SentimentLexicon,
  neutralThreshold: number = DEFAULT_NEUTRAL_THRESHOLD
): SentimentResult {
  if (tokens.length === 0) {
    return { label: "neutral", confidence: 1.0, scores: { positive: 0, negative: 0, neutral: 1 } };
  }

  const text = tokens.join(" ");
  const { positiveCorpus, negativeCorpus } = buildReferenceCorpora(lexicon);

  const posSim = 1 - ncd(text, positiveCorpus);
  const negSim = 1 - ncd(text, negativeCorpus);

  const diff = posSim - negSim;
  const { label, confidence } = classifyByDiff(posSim, negSim, diff, neutralThreshold);
  const scores = buildNormalizedScores(posSim, negSim);

  return { label, confidence, scores };
}
