/**
 * @file Naive Bayes sentiment classifier.
 *
 * If a pre-trained NaiveBayesModel is provided, classification is a
 * pure lookup (no model construction at runtime).
 *
 * If no model is provided, falls back to constructing one from the
 * lexicon on the fly (slower, less accurate).
 */

import type { SentimentResult, SentimentLabel, SentimentLexicon, NaiveBayesModel } from "../types";

// ============================================================
// Constants
// ============================================================

const DEFAULT_SMOOTHING = 1;
const LABELS: readonly SentimentLabel[] = ["positive", "negative", "neutral"];

// ============================================================
// Fallback: build model from lexicon (for backward compat)
// ============================================================

function buildModelFromLexicon(lexicon: SentimentLexicon, smoothing: number): NaiveBayesModel {
  const vocabulary = new Set<string>();
  const classCounts: Record<SentimentLabel, number> = { positive: 0, negative: 0, neutral: 0 };
  const wordClassCounts = new Map<string, Record<SentimentLabel, number>>();

  for (const [word, score] of lexicon.entries) {
    vocabulary.add(word);
    const counts: Record<SentimentLabel, number> = { positive: 0, negative: 0, neutral: 0 };

    if (score > 0.1) {
      const weight = Math.ceil(score * 10);
      counts.positive = weight;
      counts.neutral = 1;
      classCounts.positive += weight;
      classCounts.neutral += 1;
    } else if (score < -0.1) {
      const weight = Math.ceil(Math.abs(score) * 10);
      counts.negative = weight;
      counts.neutral = 1;
      classCounts.negative += weight;
      classCounts.neutral += 1;
    } else {
      counts.neutral = 5;
      classCounts.neutral += 5;
    }

    wordClassCounts.set(word, counts);
  }

  const vocabSize = vocabulary.size;
  const totalDocs = classCounts.positive + classCounts.negative + classCounts.neutral;

  const logPrior: Record<SentimentLabel, number> = {
    positive: Math.log((classCounts.positive + smoothing) / (totalDocs + smoothing * 3)),
    negative: Math.log((classCounts.negative + smoothing) / (totalDocs + smoothing * 3)),
    neutral: Math.log((classCounts.neutral + smoothing) / (totalDocs + smoothing * 3)),
  };

  const logLikelihood = new Map<string, Record<SentimentLabel, number>>();
  for (const word of vocabulary) {
    const counts = wordClassCounts.get(word) ?? { positive: 0, negative: 0, neutral: 0 };
    logLikelihood.set(word, {
      positive: Math.log((counts.positive + smoothing) / (classCounts.positive + smoothing * vocabSize)),
      negative: Math.log((counts.negative + smoothing) / (classCounts.negative + smoothing * vocabSize)),
      neutral: Math.log((counts.neutral + smoothing) / (classCounts.neutral + smoothing * vocabSize)),
    });
  }

  return { logPrior, logLikelihood, vocabSize, smoothing };
}

// ============================================================
// Classification (pure lookup)
// ============================================================

function logSumExp(values: number[]): number {
  const maxVal = Math.max(...values);
  const sum = values.reduce((acc, v) => acc + Math.exp(v - maxVal), 0);
  return maxVal + Math.log(sum);
}

function classifyWithModel(tokens: string[], model: NaiveBayesModel): SentimentResult {
  const logPosterior: Record<SentimentLabel, number> = { ...model.logPrior };
  const unknownLL = Math.log(model.smoothing / (model.smoothing * model.vocabSize));

  const knownCount = tokens.reduce((count, token) => {
    const wordLL = model.logLikelihood.get(token);
    if (wordLL) {
      for (const label of LABELS) {
        logPosterior[label] += wordLL[label];
      }
      return count + 1;
    }
    for (const label of LABELS) {
      logPosterior[label] += unknownLL;
    }
    return count;
  }, 0);

  if (knownCount === 0) {
    return { label: "neutral", confidence: 1.0, scores: { positive: 0, negative: 0, neutral: 1 } };
  }

  const logValues = LABELS.map((l) => logPosterior[l]);
  const logNorm = logSumExp(logValues);

  const scores: Record<SentimentLabel, number> = {
    positive: Math.exp(logPosterior.positive - logNorm),
    negative: Math.exp(logPosterior.negative - logNorm),
    neutral: Math.exp(logPosterior.neutral - logNorm),
  };

  const bestLabel = LABELS.reduce((best, label) => (scores[label] > scores[best] ? label : best), LABELS[0]);
  return { label: bestLabel, confidence: scores[bestLabel], scores };
}

// ============================================================
// Public API
// ============================================================

/**
 * Classify tokens using Naive Bayes.
 *
 * @param tokens - Pre-tokenized words
 * @param lexiconOrModel - Pre-trained NB model (fast) or lexicon (fallback)
 * @param smoothing - Laplace smoothing (only used for lexicon fallback)
 */
export function classifyByNaiveBayes(
  tokens: string[],
  lexiconOrModel: SentimentLexicon | NaiveBayesModel,
  smoothing: number = DEFAULT_SMOOTHING
): SentimentResult {
  if (tokens.length === 0) {
    return { label: "neutral", confidence: 1.0, scores: { positive: 0, negative: 0, neutral: 1 } };
  }

  const model = resolveModel(lexiconOrModel, smoothing);
  return classifyWithModel(tokens, model);
}

function isNbModel(x: SentimentLexicon | NaiveBayesModel): x is NaiveBayesModel {
  return "logPrior" in x;
}

function resolveModel(input: SentimentLexicon | NaiveBayesModel, smoothing: number): NaiveBayesModel {
  if (isNbModel(input)) {
    return input;
  }
  return buildModelFromLexicon(input, smoothing);
}
