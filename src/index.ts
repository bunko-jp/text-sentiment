/**
 * @file Multilingual sentiment analysis library.
 *
 * Primary API: `analyze(text, language, options?)`
 *
 * Strategies: Naive Bayes, TF-IDF, NCD (all share the same tokenization SoT).
 * Features: ensemble, per-category breakdown, toxic detection.
 * Data: all lexicons loaded from pre-built binaries (bun run build:data).
 */

// ============================================================
// Unified API
// ============================================================

export { analyze, type AnalyzeOptions, type AnalyzeResult, type StrategyName } from "./analyze";

// ============================================================
// Core Types
// ============================================================

export type {
  SentimentLabel,
  SentimentCategory,
  SentimentResult,
  CategorySentimentResult,
  SentimentStrategy,
  SentimentLexicon,
  LexiconEntry,
  ToxicMatch,
  ToxicCategory,
  ToxicDetectionResult,
  ToxicLexicon,
  NaiveBayesModel,
} from "./types";

// ============================================================
// Tokenizer & Segmenter
// ============================================================

export { tokenizeText } from "./utils/tokenizer";
export { segmentJapanese, segmentText } from "./utils/segmenter";

// ============================================================
// Lexicons (data-driven)
// ============================================================

export {
  getLexicon,
  getNbModel,
  getToxicLexicon,
  supportedLanguages,
  scoreLexicon,
  registerLexicon,
  registerNbModel,
  registerToxicLexicon,
  registerLexiconFromBinary,
  registerToxicLexiconFromBinary,
} from "./lexicons/index";

// ============================================================
// Data Codec
// ============================================================

export {
  encodeSentimentData,
  encodeSentimentEntries,
  decodeSentimentData,
  encodeToxicData,
  encodeToxicEntries,
  decodeToxicData,
  type SentimentEntry,
  type ToxicEntry,
} from "./utils/data-codec";

// ============================================================
// Low-level strategy classifiers (tokens → result)
// ============================================================

export { classifyByNaiveBayes } from "./strategies/naive-bayes";
export { classifyByTfidf } from "./strategies/tfidf";
export { classifyByNcd } from "./strategies/ncd";
