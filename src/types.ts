/**
 * @file Core types for sentiment analysis.
 */

// ============================================================
// Sentiment Labels
// ============================================================

/** Sentiment classification label */
export type SentimentLabel = "positive" | "negative" | "neutral";

/** Predefined sentiment categories for per-aspect analysis */
export type SentimentCategory = "general" | "quality" | "service" | "price" | "usability" | "emotion" | "appearance";

// ============================================================
// Sentiment Result
// ============================================================

/** Result of a sentiment analysis */
export type SentimentResult = {
  /** Classified sentiment label */
  label: SentimentLabel;
  /** Confidence score in [0, 1] */
  confidence: number;
  /** Per-label scores (higher = more likely) */
  scores: Record<SentimentLabel, number>;
};

/** Per-category sentiment result */
export type CategorySentimentResult = {
  /** Overall sentiment (aggregated across categories) */
  overall: SentimentResult;
  /** Per-category sentiment breakdown */
  categories: Partial<Record<SentimentCategory, SentimentResult>>;
};

// ============================================================
// Strategy Interface
// ============================================================

/** Common interface for sentiment analysis strategies */
export type SentimentStrategy = {
  /** Strategy name */
  name: string;
  /** Analyze text and return sentiment result */
  analyze(text: string): SentimentResult;
};

// ============================================================
// Lexicon Types
// ============================================================

/** A sentiment lexicon entry: word mapped to a score in [-1, 1] with optional category */
export type LexiconEntry = {
  word: string;
  /** Score: negative values = negative sentiment, positive = positive */
  score: number;
  /** Category this word belongs to (default: "general") */
  category?: SentimentCategory;
};

/** A complete sentiment lexicon for a language */
export type SentimentLexicon = {
  /** Language code (e.g. "ja", "en") */
  language: string;
  /** Word-to-score mapping */
  entries: Map<string, number>;
  /** Word-to-category mapping */
  categories: Map<string, SentimentCategory>;
};

// ============================================================
// Toxic Detection
// ============================================================

/** A single toxic word detection */
export type ToxicMatch = {
  /** The detected toxic word */
  word: string;
  /** Severity: higher = worse */
  severity: number;
  /** Category of toxicity */
  category: ToxicCategory;
};

/** Categories of toxic content */
export type ToxicCategory = "sexual" | "slur" | "profanity" | "violence" | "discrimination";

/** Result of toxic content detection */
export type ToxicDetectionResult = {
  /** Whether any toxic content was detected */
  toxic: boolean;
  /** All detected toxic matches */
  matches: ToxicMatch[];
  /** Maximum severity among all matches (0 if none) */
  maxSeverity: number;
};

// ============================================================
// Naive Bayes Model
// ============================================================

/** Pre-trained Naive Bayes model weights */
export type NaiveBayesModel = {
  /** Log prior per label */
  logPrior: Record<SentimentLabel, number>;
  /** Log likelihood per word per label */
  logLikelihood: Map<string, Record<SentimentLabel, number>>;
  /** Vocabulary size (for unknown word smoothing) */
  vocabSize: number;
  /** Smoothing parameter used during training */
  smoothing: number;
};

/** A toxic word lexicon for a language */
export type ToxicLexicon = {
  language: string;
  /** word → { severity, category } */
  entries: Map<string, { severity: number; category: ToxicCategory }>;
};

