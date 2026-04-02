/**
 * @file Unified analysis entry point.
 *
 * Single function `analyze(text, language, options?)` that:
 * 1. Tokenizes text once (SoT for all strategies)
 * 2. Runs selected sentiment strategy (NB / TF-IDF / NCD)
 * 3. Optionally runs ensemble (weighted combination)
 * 4. Optionally runs toxic detection
 * 5. Optionally runs category breakdown
 */

import type {
  SentimentResult,
  SentimentLabel,
  SentimentCategory,
  ToxicDetectionResult,
  ToxicMatch,
} from "./types";
import { tokenizeText } from "./utils/tokenizer";
import { getLexicon, getNbModel, getToxicLexicon } from "./lexicons/index";
import { classifyByNaiveBayes } from "./strategies/naive-bayes";
import { classifyByTfidf } from "./strategies/tfidf";
import { classifyByNcd } from "./strategies/ncd";

// ============================================================
// Options
// ============================================================

/** Strategy selection */
export type StrategyName = "naive-bayes" | "tfidf" | "ncd";

/** Options for analyze() */
export type AnalyzeOptions = {
  /** Sentiment strategy (default: "naive-bayes") */
  strategy?: StrategyName;
  /** Run ensemble of multiple strategies with weights */
  ensemble?: {
    strategies?: StrategyName[];
    weights?: Partial<Record<StrategyName, number>>;
  };
  /** Include per-category sentiment breakdown */
  categories?: boolean;
  /** Include toxic content detection */
  toxic?: boolean;
  /** NB smoothing parameter */
  smoothing?: number;
  /** TF-IDF / NCD neutral threshold */
  neutralThreshold?: number;
};

/** Full analysis result */
export type AnalyzeResult = {
  /** Primary sentiment result */
  sentiment: SentimentResult;
  /** Per-category breakdown (if options.categories) */
  categories?: Partial<Record<SentimentCategory, SentimentResult>>;
  /** Toxic detection result (if options.toxic) */
  toxic?: ToxicDetectionResult;
  /** Tokens produced by the segmenter (for inspection) */
  tokens: string[];
};

// ============================================================
// Constants
// ============================================================

const LABELS: readonly SentimentLabel[] = ["positive", "negative", "neutral"];
const ALL_CATEGORIES: readonly SentimentCategory[] = [
  "general",
  "quality",
  "service",
  "price",
  "usability",
  "emotion",
  "appearance",
];

const DEFAULT_ENSEMBLE_STRATEGIES: StrategyName[] = ["naive-bayes", "tfidf", "ncd"];
const DEFAULT_ENSEMBLE_WEIGHTS: Record<StrategyName, number> = {
  "naive-bayes": 0.6,
  tfidf: 0.25,
  ncd: 0.15,
};

// ============================================================
// Internal: strategy dispatch
// ============================================================

function runStrategy(
  name: StrategyName,
  tokens: string[],
  language: string,
  opts: AnalyzeOptions
): SentimentResult {
  const lexicon = getLexicon(language);
  switch (name) {
    case "naive-bayes": {
      const model = getNbModel(language);
      return classifyByNaiveBayes(tokens, model ?? lexicon, opts.smoothing);
    }
    case "tfidf":
      return classifyByTfidf(tokens, lexicon, opts.neutralThreshold);
    case "ncd":
      return classifyByNcd(tokens, lexicon, opts.neutralThreshold);
  }
}

// ============================================================
// Internal: ensemble
// ============================================================

function runEnsemble(tokens: string[], language: string, opts: AnalyzeOptions): SentimentResult {
  const strategies = opts.ensemble?.strategies ?? DEFAULT_ENSEMBLE_STRATEGIES;
  const weights = { ...DEFAULT_ENSEMBLE_WEIGHTS, ...opts.ensemble?.weights };

  const results = strategies.map((name) => ({
    name,
    result: runStrategy(name, tokens, language, opts),
    weight: weights[name] ?? 1,
  }));

  const combined: Record<SentimentLabel, number> = { positive: 0, negative: 0, neutral: 0 };

  for (const { result, weight } of results) {
    for (const label of LABELS) {
      combined[label] += result.scores[label] * weight;
    }
  }

  const scoreTotal = combined.positive + combined.negative + combined.neutral;
  if (scoreTotal > 0) {
    for (const label of LABELS) {
      combined[label] /= scoreTotal;
    }
  }

  const bestLabel = LABELS.reduce((best, label) => (combined[label] > combined[best] ? label : best), LABELS[0]);

  return { label: bestLabel, confidence: combined[bestLabel], scores: combined };
}

// ============================================================
// Internal: toxic detection
// ============================================================

function detectToxicFromTokens(tokens: string[], language: string): ToxicDetectionResult {
  const lexicon = getToxicLexicon(language);
  const matches: ToxicMatch[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const entry = lexicon.entries.get(token);
    if (entry && !seen.has(token)) {
      seen.add(token);
      matches.push({ word: token, severity: entry.severity, category: entry.category });
    }
  }

  // Adjacent token pairs (e.g. "死"+"ね" → "死ね")
  for (const [i, token] of tokens.entries()) {
    const next = tokens[i + 1];
    if (!next) {
      continue;
    }
    const pair = token + next;
    const entry = lexicon.entries.get(pair);
    if (entry && !seen.has(pair)) {
      seen.add(pair);
      matches.push({ word: pair, severity: entry.severity, category: entry.category });
    }
  }

  const maxSeverity = matches.reduce((max, m) => Math.max(max, m.severity), 0);
  return { toxic: matches.length > 0, matches, maxSeverity };
}

// ============================================================
// Internal: category breakdown
// ============================================================

function breakdownByCategory(
  tokens: string[],
  language: string
): Partial<Record<SentimentCategory, SentimentResult>> {
  const lexicon = getLexicon(language);
  const categoryScores = new Map<SentimentCategory, number[]>();

  for (const token of tokens) {
    const score = lexicon.entries.get(token);
    if (score === undefined) {
      continue;
    }
    const category = lexicon.categories.get(token) ?? "general";
    const existing = categoryScores.get(category);
    if (existing) {
      existing.push(score);
    } else {
      categoryScores.set(category, [score]);
    }
  }

  const categories: Partial<Record<SentimentCategory, SentimentResult>> = {};
  for (const category of ALL_CATEGORIES) {
    const scores = categoryScores.get(category);
    if (scores && scores.length > 0) {
      categories[category] = scoresToResult(scores);
    }
  }
  return categories;
}

function scoresToResult(scores: number[]): SentimentResult {
  if (scores.length === 0) {
    return { label: "neutral", confidence: 1.0, scores: { positive: 0, negative: 0, neutral: 1 } };
  }

  const posSum = scores.filter((s) => s > 0).reduce((a, b) => a + b, 0);
  const negSum = scores.filter((s) => s < 0).reduce((a, b) => a + Math.abs(b), 0);
  const total = posSum + negSum;

  if (total === 0) {
    return { label: "neutral", confidence: 1.0, scores: { positive: 0, negative: 0, neutral: 1 } };
  }

  const posNorm = posSum / total;
  const negNorm = negSum / total;
  const magnitude = total / scores.length;
  const neutralWeight = Math.max(0, 1 - magnitude);

  const scoreTotal = posNorm + negNorm + neutralWeight;
  const normalized: Record<SentimentLabel, number> = {
    positive: posNorm / scoreTotal,
    negative: negNorm / scoreTotal,
    neutral: neutralWeight / scoreTotal,
  };

  const bestLabel = LABELS.reduce((best, label) => (normalized[label] > normalized[best] ? label : best), LABELS[0]);
  return { label: bestLabel, confidence: normalized[bestLabel], scores: normalized };
}

// ============================================================
// Internal: strategy selection
// ============================================================

function selectAndRun(tokens: string[], language: string, opts: AnalyzeOptions): SentimentResult {
  if (opts.ensemble) {
    return runEnsemble(tokens, language, opts);
  }
  return runStrategy(opts.strategy ?? "naive-bayes", tokens, language, opts);
}

// ============================================================
// Public API
// ============================================================

/**
 * Unified sentiment analysis entry point.
 *
 * Tokenizes text once, then runs the selected strategy (or ensemble).
 * Optionally includes toxic detection and category breakdown.
 *
 * @param text - Text to analyze
 * @param language - Language code ("en", "ja")
 * @param options - Analysis options
 *
 * @example
 * ```ts
 * // Simple NB analysis
 * analyze("素晴らしい作品", "ja")
 *
 * // Ensemble with toxic detection
 * analyze("text", "en", { ensemble: {}, toxic: true })
 *
 * // Category breakdown
 * analyze("text", "ja", { categories: true })
 * ```
 */
export function analyze(text: string, language: string, options?: AnalyzeOptions): AnalyzeResult {
  const opts = options ?? {};
  const tokens = tokenizeText(text, language);

  if (tokens.length === 0) {
    const neutral: SentimentResult = {
      label: "neutral",
      confidence: 1.0,
      scores: { positive: 0, negative: 0, neutral: 1 },
    };
    return {
      sentiment: neutral,
      tokens,
      ...(opts.categories ? { categories: {} } : {}),
      ...(opts.toxic ? { toxic: { toxic: false, matches: [], maxSeverity: 0 } } : {}),
    };
  }

  // Sentiment: ensemble or single strategy
  const sentiment = selectAndRun(tokens, language, opts);

  const result: AnalyzeResult = { sentiment, tokens };

  if (opts.categories) {
    result.categories = breakdownByCategory(tokens, language);
  }

  if (opts.toxic) {
    result.toxic = detectToxicFromTokens(tokens, language);
  }

  return result;
}
