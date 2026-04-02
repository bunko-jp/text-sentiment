/**
 * @file Unified codec for sentiment and toxic lexicon binary data.
 *
 * Compression-optimized columnar format with:
 * - Columnar layout (words[], scores[], categories[])
 * - Score delta encoding (sorted → consecutive differences are small)
 * - Category as uint8 enum
 * - NB model: palette + index (log-likelihoods have very few unique triplets)
 * - NB words shared with lexicon words (no duplication)
 */

import { encode, decode } from "@msgpack/msgpack";
import { deflateSync, inflateSync } from "fflate";
import type { SentimentCategory, SentimentLabel, SentimentLexicon, NaiveBayesModel, ToxicCategory, ToxicLexicon } from "../types";

// ============================================================
// Category enum mappings
// ============================================================

const SENTIMENT_CATEGORIES: readonly SentimentCategory[] = [
  "general", "quality", "service", "price", "usability", "emotion", "appearance",
];
const TOXIC_CATEGORIES: readonly ToxicCategory[] = [
  "sexual", "slur", "profanity", "violence", "discrimination",
];

function sentimentCategoryToIndex(cat: SentimentCategory): number {
  const idx = SENTIMENT_CATEGORIES.indexOf(cat);
  return idx >= 0 ? idx : 0;
}
function indexToSentimentCategory(idx: number): SentimentCategory {
  return SENTIMENT_CATEGORIES[idx] ?? "general";
}
function toxicCategoryToIndex(cat: ToxicCategory): number {
  const idx = TOXIC_CATEGORIES.indexOf(cat);
  return idx >= 0 ? idx : 2;
}
function indexToToxicCategory(idx: number): ToxicCategory {
  return TOXIC_CATEGORIES[idx] ?? "profanity";
}

// ============================================================
// Score quantization + delta encoding
// ============================================================

const SCALE = 10000;

function quantize(score: number): number {
  return Math.round(score * SCALE);
}
function dequantize(q: number): number {
  return q / SCALE;
}

/** Encode sorted scores as deltas: [first, d1, d2, ...] */
function deltaEncode(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }
  const result = [values[0]];
  for (const [i, v] of values.entries()) {
    if (i > 0) {
      result.push(v - values[i - 1]);
    }
  }
  return result;
}

/** Decode deltas back to absolute values */
function deltaDecode(deltas: number[]): number[] {
  if (deltas.length === 0) {
    return [];
  }
  const result = [deltas[0]];
  for (const [i, d] of deltas.entries()) {
    if (i > 0) {
      result.push(result[i - 1] + d);
    }
  }
  return result;
}

// ============================================================
// NB model palette encoding
// ============================================================

type NbTriplet = [number, number, number];

/** Build palette: unique triplets → index, plus index array */
function paletteEncode(triplets: NbTriplet[]): { palette: NbTriplet[]; indices: number[] } {
  const keyToIdx = new Map<string, number>();
  const palette: NbTriplet[] = [];
  const indices: number[] = [];

  for (const t of triplets) {
    const key = `${t[0]},${t[1]},${t[2]}`;
    const existing = keyToIdx.get(key);
    if (existing !== undefined) {
      indices.push(existing);
    } else {
      const idx = palette.length;
      keyToIdx.set(key, idx);
      palette.push(t);
      indices.push(idx);
    }
  }

  return { palette, indices };
}

// ============================================================
// Wire format types
// ============================================================

type WireNbModel = {
  /** log prior: [pos, neg, neu] */
  lp: NbTriplet;
  /** palette of unique [pos, neg, neu] triplets */
  pt: NbTriplet[];
  /** per-word index into palette (uint8 — max 255 unique triplets) */
  pi: number[];
  /** vocab size */
  vs: number;
  /** smoothing */
  sm: number;
};

type WireSentimentPayload = {
  v: 1;
  type: "sentiment";
  lang: string;
  /** words */
  w: string[];
  /** scores as delta-encoded quantized int16 */
  sd: number[];
  /** category indices (uint8) */
  c: number[];
  /** pre-trained NB model */
  nb?: WireNbModel;
};

type WireToxicPayload = {
  v: 1;
  type: "toxic";
  lang: string;
  w: string[];
  /** severity as delta-encoded quantized int16 */
  sd: number[];
  c: number[];
};

type WirePayload = WireSentimentPayload | WireToxicPayload;

// ============================================================
// Public entry types
// ============================================================

export type SentimentEntry = { word: string; score: number; category: SentimentCategory };
export type ToxicEntry = { word: string; severity: number; category: ToxicCategory };
export type SentimentData = { lexicon: SentimentLexicon; nbModel?: NaiveBayesModel };

// ============================================================
// Encode
// ============================================================

/** Encode a sentiment lexicon into compressed binary. */
export function encodeSentimentData(lexicon: SentimentLexicon): Uint8Array {
  const entries: SentimentEntry[] = [...lexicon.entries].map(([word, score]) => ({
    word, score, category: lexicon.categories.get(word) ?? "general",
  }));
  return encodeSentimentEntries(entries, lexicon.language);
}

/** Encode pre-sorted sentiment entries (with optional NB model). */
export function encodeSentimentEntries(
  entries: readonly SentimentEntry[],
  language: string,
  nbModel?: NaiveBayesModel
): Uint8Array {
  const quantizedScores = entries.map((e) => quantize(e.score));

  const payload: WireSentimentPayload = {
    v: 1,
    type: "sentiment",
    lang: language,
    w: entries.map((e) => e.word),
    sd: deltaEncode(quantizedScores),
    c: entries.map((e) => sentimentCategoryToIndex(e.category)),
  };

  if (nbModel) {
    // NB words share the same order as lexicon words — no separate word array
    const words = entries.map((e) => e.word);
    const triplets: NbTriplet[] = words.map((w) => {
      const ll = nbModel.logLikelihood.get(w);
      return ll ? [ll.positive, ll.negative, ll.neutral] : [0, 0, 0];
    });
    const { palette, indices } = paletteEncode(triplets);

    payload.nb = {
      lp: [nbModel.logPrior.positive, nbModel.logPrior.negative, nbModel.logPrior.neutral],
      pt: palette,
      pi: indices,
      vs: nbModel.vocabSize,
      sm: nbModel.smoothing,
    };
  }

  return deflateSync(new Uint8Array(encode(payload)), { level: 9 });
}

/** Encode a toxic lexicon into compressed binary. */
export function encodeToxicData(lexicon: ToxicLexicon): Uint8Array {
  const entries: ToxicEntry[] = [...lexicon.entries].map(([word, { severity, category }]) => ({
    word, severity, category,
  }));
  return encodeToxicEntries(entries, lexicon.language);
}

/** Encode pre-sorted toxic entries. */
export function encodeToxicEntries(entries: readonly ToxicEntry[], language: string): Uint8Array {
  const quantizedSeverities = entries.map((e) => quantize(e.severity));

  const payload: WireToxicPayload = {
    v: 1,
    type: "toxic",
    lang: language,
    w: entries.map((e) => e.word),
    sd: deltaEncode(quantizedSeverities),
    c: entries.map((e) => toxicCategoryToIndex(e.category)),
  };

  return deflateSync(new Uint8Array(encode(payload)), { level: 9 });
}

// ============================================================
// Decode
// ============================================================

/** Decode compressed binary into a sentiment lexicon + optional NB model. */
export function decodeSentimentData(data: Uint8Array): SentimentData {
  const payload = decodePayload(data) as WireSentimentPayload;
  if (payload.type !== "sentiment") {
    throw new Error(`Expected sentiment data, got ${payload.type}`);
  }

  const scores = deltaDecode(payload.sd);
  const entries = new Map<string, number>();
  const categories = new Map<string, SentimentCategory>();
  for (const i of Array(payload.w.length).keys()) {
    entries.set(payload.w[i], dequantize(scores[i]));
    categories.set(payload.w[i], indexToSentimentCategory(payload.c[i]));
  }

  const lexicon: SentimentLexicon = { language: payload.lang, entries, categories };

  if (!payload.nb) {
    return { lexicon };
  }

  // Reconstruct NB model: palette lookup + shared word order
  const logLikelihood = new Map<string, Record<SentimentLabel, number>>();
  for (const [i, word] of payload.w.entries()) {
    const [pos, neg, neu] = payload.nb.pt[payload.nb.pi[i]];
    logLikelihood.set(word, { positive: pos, negative: neg, neutral: neu });
  }

  const [priorPos, priorNeg, priorNeu] = payload.nb.lp;
  const nbModel: NaiveBayesModel = {
    logPrior: { positive: priorPos, negative: priorNeg, neutral: priorNeu },
    logLikelihood,
    vocabSize: payload.nb.vs,
    smoothing: payload.nb.sm,
  };

  return { lexicon, nbModel };
}

/** Decode compressed binary into a toxic lexicon. */
export function decodeToxicData(data: Uint8Array): ToxicLexicon {
  const payload = decodePayload(data) as WireToxicPayload;
  if (payload.type !== "toxic") {
    throw new Error(`Expected toxic data, got ${payload.type}`);
  }

  const severities = deltaDecode(payload.sd);
  const entries = new Map<string, { severity: number; category: ToxicCategory }>();
  for (const i of Array(payload.w.length).keys()) {
    entries.set(payload.w[i], {
      severity: dequantize(severities[i]),
      category: indexToToxicCategory(payload.c[i]),
    });
  }

  return { language: payload.lang, entries };
}

// ============================================================
// Internal
// ============================================================

function decodePayload(data: Uint8Array): WirePayload {
  const inflated = inflateSync(data);
  const payload = decode(inflated) as WirePayload;
  if (payload.v !== 1) {
    throw new Error(`Unsupported data format version: ${payload.v}`);
  }
  return payload;
}
