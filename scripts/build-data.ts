/**
 * @file Build script: download corpora and compile all lexicon binaries.
 *
 * Sentiment sources:
 *   - JA: Tohoku University Japanese Sentiment Polarity Dictionary (via oseti, MIT)
 *         pn_noun.json (8.3K nouns) + pn_wago.json (3K verbs/adj)
 *   - EN: AFINN-en-165 (2.5K, TSV, score -5 to +5)
 *       + VADER lexicon (7.5K, TSV, score ~-4 to +4)
 *
 * Toxic sources:
 *   - JA: inappropriate-words-ja (MIT) + LDNOOBW V2 (CC0)
 *       + japanese-toxic-dataset (Apache-2.0, NCD feature extraction)
 *   - EN: words/cuss (MIT, sureness >= 1)
 *
 * Outputs:
 *   src/data/sentiment-{lang}.bin
 *   src/data/toxic-{lang}.bin
 *
 * Usage: bun run build:data
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cuss } from "cuss";
import { deflateSync } from "fflate";
import { encodeSentimentEntries, encodeToxicEntries } from "../src/utils/data-codec";
import type { SentimentEntry, ToxicEntry } from "../src/utils/data-codec";
import type { SentimentCategory, SentimentLabel, NaiveBayesModel, ToxicCategory } from "../src/types";

// ============================================================
// URLs
// ============================================================

const URLS = {
  // Sentiment
  jaNoun: "https://raw.githubusercontent.com/ikegami-yukino/oseti/master/oseti/dic/pn_noun.json",
  jaWago: "https://raw.githubusercontent.com/ikegami-yukino/oseti/master/oseti/dic/pn_wago.json",
  enAfinn: "https://raw.githubusercontent.com/fnielsen/afinn/master/afinn/data/AFINN-en-165.txt",
  enVader: "https://raw.githubusercontent.com/cjhutto/vaderSentiment/master/vaderSentiment/vader_lexicon.txt",

  // Toxic
  jaSexual: "https://raw.githubusercontent.com/MosasoM/inappropriate-words-ja/master/Sexual.txt",
  jaOffensive: "https://raw.githubusercontent.com/MosasoM/inappropriate-words-ja/master/Offensive.txt",
  jaLdnoobw:
    "https://github.com/LDNOOBWV2/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words_V2/raw/refs/heads/main/data/ja.txt",
  jaToxicDataset: "https://raw.githubusercontent.com/inspection-ai/japanese-toxic-dataset/main/data/subset.csv",
};

const OUT_DIR = resolve(import.meta.dir, "../src/data");

// ============================================================
// Helpers
// ============================================================

async function fetchBytes(url: string): Promise<Uint8Array> {
  console.log(`  Fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchText(url: string): Promise<string> {
  const bytes = await fetchBytes(url);
  return new TextDecoder("utf-8").decode(bytes);
}

function parseTxtWordList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith(";"));
}

function writeBin(filename: string, data: Uint8Array, entries: number): void {
  const outPath = resolve(OUT_DIR, filename);
  writeFileSync(outPath, data);
  console.log(`  Written ${filename} (${data.length} bytes, ${entries} entries)`);
}

// ============================================================
// Compression-optimal sorting (category → score → lexicographic)
// ============================================================

type GenericEntry<C> = { word: string; score: number; category: C };

/**
 * Sort entries for optimal deflate compression.
 *
 * Category grouping keeps enum column repetitive.
 * Score ordering keeps quantized int16 column smooth.
 * Lexicographic tiebreak keeps word column locally similar.
 *
 * Tested against NCD-based greedy nearest/farthest neighbor —
 * this simple sort consistently wins on deflate output size.
 */
function compressionSort<C>(entries: GenericEntry<C>[], categoryOrder: (cat: C) => number): GenericEntry<C>[] {
  return [...entries].sort((a, b) => {
    const catCmp = categoryOrder(a.category) - categoryOrder(b.category);
    if (catCmp !== 0) {
      return catCmp;
    }
    const scoreCmp = a.score - b.score;
    if (scoreCmp !== 0) {
      return scoreCmp;
    }
    return a.word.localeCompare(b.word);
  });
}

const SENTIMENT_CATEGORY_ORDER: Record<string, number> = {
  general: 0,
  quality: 1,
  service: 2,
  price: 3,
  usability: 4,
  emotion: 5,
  appearance: 6,
};

const TOXIC_CATEGORY_ORDER: Record<string, number> = {
  sexual: 0,
  slur: 1,
  profanity: 2,
  violence: 3,
  discrimination: 4,
};

// ============================================================
// NB model training from lexicon
// ============================================================

const LABELS: SentimentLabel[] = ["positive", "negative", "neutral"];

/**
 * Train a Naive Bayes model from a lexicon.
 *
 * Uses lexicon scores to generate pseudo-counts per class,
 * then computes log-priors and log-likelihoods with Laplace smoothing.
 * The trained model is serialized into the binary so runtime is pure lookup.
 */
function trainNbModel(entries: Map<string, number>, smoothing: number = 1): NaiveBayesModel {
  const classCounts: Record<SentimentLabel, number> = { positive: 0, negative: 0, neutral: 0 };
  const wordClassCounts = new Map<string, Record<SentimentLabel, number>>();

  for (const [word, score] of entries) {
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

  const vocabSize = entries.size;
  const totalDocs = classCounts.positive + classCounts.negative + classCounts.neutral;

  const logPrior: Record<SentimentLabel, number> = {
    positive: Math.log((classCounts.positive + smoothing) / (totalDocs + smoothing * 3)),
    negative: Math.log((classCounts.negative + smoothing) / (totalDocs + smoothing * 3)),
    neutral: Math.log((classCounts.neutral + smoothing) / (totalDocs + smoothing * 3)),
  };

  const logLikelihood = new Map<string, Record<SentimentLabel, number>>();
  for (const [word, counts] of wordClassCounts) {
    logLikelihood.set(word, {
      positive: Math.log((counts.positive + smoothing) / (classCounts.positive + smoothing * vocabSize)),
      negative: Math.log((counts.negative + smoothing) / (classCounts.negative + smoothing * vocabSize)),
      neutral: Math.log((counts.neutral + smoothing) / (classCounts.neutral + smoothing * vocabSize)),
    });
  }

  return { logPrior, logLikelihood, vocabSize, smoothing };
}

// ============================================================
// NCD-based toxic word extraction from sentence corpus
// ============================================================

const encoder = new TextEncoder();

function compressedSize(text: string): number {
  return deflateSync(encoder.encode(text)).length;
}

function ncd(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) {
    return 1;
  }
  const cA = compressedSize(a);
  const cB = compressedSize(b);
  const cAB = compressedSize(a + b);
  const maxC = Math.max(cA, cB);
  return maxC === 0 ? 0 : (cAB - Math.min(cA, cB)) / maxC;
}

/**
 * Extract toxic-indicative words from labeled sentences using NCD.
 *
 * For each toxic sentence, remove one word at a time and measure
 * NCD between the original and the reduced sentence against a
 * clean reference. Words whose removal most increases similarity
 * to the clean reference are likely the toxic-contributing words.
 */
function extractToxicWordsViaNcd(
  toxicSentences: string[],
  cleanSentences: string[]
): Map<string, number> {
  const cleanRef = cleanSentences.slice(0, 50).join(" ");
  const wordScores = new Map<string, number>();

  // Sample to keep build time reasonable
  const sample = toxicSentences.slice(0, 200);

  for (const sentence of sample) {
    const words = sentence.split(/[\s、。！？!?,.\s]+/).filter((w) => w.length >= 2);
    if (words.length < 2) {
      continue;
    }

    const baseNcd = ncd(sentence, cleanRef);

    for (const word of words) {
      const reduced = words.filter((w) => w !== word).join(" ");
      const reducedNcd = ncd(reduced, cleanRef);
      // If removing this word makes the sentence more similar to clean text,
      // the word contributes to toxicity
      const contribution = baseNcd - reducedNcd;
      if (contribution > 0.01) {
        const existing = wordScores.get(word) ?? 0;
        wordScores.set(word, existing + contribution);
      }
    }
  }

  return wordScores;
}

// ============================================================
// Sentiment: Japanese (Tohoku University via oseti)
// ============================================================

async function buildSentimentJa(): Promise<void> {
  console.log("\n[sentiment-ja] Building...");
  const [nounText, wagoText] = await Promise.all([fetchText(URLS.jaNoun), fetchText(URLS.jaWago)]);

  const nounDict = JSON.parse(nounText) as Record<string, string>;
  const wagoDict = JSON.parse(wagoText) as Record<string, string>;

  const entries = new Map<string, number>();
  const categories = new Map<string, SentimentCategory>();

  // Nouns: "p" → +0.5, "n" → -0.5, "e" → 0
  for (const [word, label] of Object.entries(nounDict)) {
    if (label === "p") {
      entries.set(word, 0.5);
    } else if (label === "n") {
      entries.set(word, -0.5);
    }
    // Skip "e" (neutral) — omitting them keeps the lexicon lean
    categories.set(word, "general");
  }

  // Wago (verbs/adj): "ポジ(…)" → +0.5, "ネガ(…)" → -0.5
  for (const [word, label] of Object.entries(wagoDict)) {
    const score = label.startsWith("ポジ") ? 0.5 : -0.5;
    entries.set(word, score);
    categories.set(word, wagoCategory(label));
  }

  const raw: GenericEntry<SentimentCategory>[] = [...entries].map(([word, score]) => ({
    word,
    score,
    category: categories.get(word) ?? "general",
  }));

  const sorted = compressionSort(raw, (c) => SENTIMENT_CATEGORY_ORDER[c] ?? 0);
  const sentEntries: SentimentEntry[] = sorted.map((e) => ({ word: e.word, score: e.score, category: e.category }));

  console.log("  Training NB model...");
  const nbModel = trainNbModel(entries);
  console.log(`  NB model: ${nbModel.logLikelihood.size} words`);

  const binary = encodeSentimentEntries(sentEntries, "ja", nbModel);
  writeBin("sentiment-ja.bin", binary, entries.size);
}

function wagoCategory(label: string): SentimentCategory {
  if (label.includes("経験")) {
    return "emotion";
  }
  if (label.includes("評価")) {
    return "quality";
  }
  return "general";
}

// ============================================================
// Sentiment: English (AFINN + VADER merge)
// ============================================================

async function buildSentimentEn(): Promise<void> {
  console.log("\n[sentiment-en] Building...");
  const [afinnText, vaderText] = await Promise.all([fetchText(URLS.enAfinn), fetchText(URLS.enVader)]);

  const entries = new Map<string, number>();
  const categories = new Map<string, SentimentCategory>();

  // VADER first (larger, base layer)
  for (const line of vaderText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }
    const parts = trimmed.split("\t");
    if (parts.length < 2) {
      continue;
    }
    const word = parts[0].toLowerCase().trim();
    const score = parseFloat(parts[1]);
    if (isNaN(score) || !word) {
      continue;
    }
    // VADER scores are roughly -4 to +4, normalize to -1 to +1
    entries.set(word, Math.max(-1, Math.min(1, score / 4)));
    categories.set(word, "general");
  }

  // AFINN overlay (higher quality, overwrite)
  for (const line of afinnText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const tabIdx = trimmed.lastIndexOf("\t");
    if (tabIdx === -1) {
      continue;
    }
    const word = trimmed.slice(0, tabIdx).toLowerCase().trim();
    const score = parseInt(trimmed.slice(tabIdx + 1), 10);
    if (isNaN(score) || !word) {
      continue;
    }
    // AFINN scores are -5 to +5, normalize to -1 to +1
    entries.set(word, Math.max(-1, Math.min(1, score / 5)));
    categories.set(word, "general");
  }

  const raw: GenericEntry<SentimentCategory>[] = [...entries].map(([word, score]) => ({
    word,
    score,
    category: categories.get(word) ?? "general",
  }));

  const sorted = compressionSort(raw, (c) => SENTIMENT_CATEGORY_ORDER[c] ?? 0);
  const sentEntries: SentimentEntry[] = sorted.map((e) => ({ word: e.word, score: e.score, category: e.category }));

  console.log("  Training NB model...");
  const nbModel = trainNbModel(entries);
  console.log(`  NB model: ${nbModel.logLikelihood.size} words`);

  const binary = encodeSentimentEntries(sentEntries, "en", nbModel);
  writeBin("sentiment-en.bin", binary, entries.size);
}

// ============================================================
// Toxic: Japanese (corpora + NCD extraction)
// ============================================================

async function buildToxicJa(): Promise<void> {
  console.log("\n[toxic-ja] Building...");

  const [sexualText, offensiveText, ldnoobwText, toxicCsvText] = await Promise.all([
    fetchText(URLS.jaSexual),
    fetchText(URLS.jaOffensive),
    fetchText(URLS.jaLdnoobw),
    fetchText(URLS.jaToxicDataset),
  ]);

  const entries = new Map<string, { severity: number; category: ToxicCategory }>();

  // Word lists
  for (const word of parseTxtWordList(sexualText)) {
    entries.set(word, { severity: 0.8, category: "sexual" });
  }
  for (const word of parseTxtWordList(offensiveText)) {
    if (!entries.has(word)) {
      entries.set(word, { severity: 0.7, category: "slur" });
    }
  }
  for (const word of parseTxtWordList(ldnoobwText)) {
    if (!entries.has(word)) {
      entries.set(word, { severity: 0.6, category: "profanity" });
    }
  }

  // NCD extraction from japanese-toxic-dataset
  console.log("  Extracting toxic words via NCD from sentence corpus...");
  const { toxic, clean } = parseToxicDatasetCsv(toxicCsvText);
  console.log(`  Toxic sentences: ${toxic.length}, Clean sentences: ${clean.length}`);

  const ncdWords = extractToxicWordsViaNcd(toxic, clean);
  console.log(`  NCD extracted ${ncdWords.size} candidate words`);

  // Add NCD-extracted words that aren't already in the lexicon
  const ncdSorted = [...ncdWords.entries()].sort((a, b) => b[1] - a[1]);
  const ncdAdded = ncdSorted.reduce((count, [word, score]) => {
    if (!entries.has(word) && score > 0.05 && word.length >= 2) {
      entries.set(word, { severity: Math.min(0.9, 0.4 + score), category: "profanity" });
      return count + 1;
    }
    return count;
  }, 0);
  console.log(`  Added ${ncdAdded} new words from NCD extraction`);

  const raw: GenericEntry<ToxicCategory>[] = [...entries].map(([word, { severity, category }]) => ({
    word,
    score: severity,
    category,
  }));

  const sorted = compressionSort(raw, (c) => TOXIC_CATEGORY_ORDER[c] ?? 0);
  const toxEntries: ToxicEntry[] = sorted.map((e) => ({ word: e.word, severity: e.score, category: e.category }));

  const binary = encodeToxicEntries(toxEntries, "ja");
  writeBin("toxic-ja.bin", binary, entries.size);
}

/**
 * Parse japanese-toxic-dataset CSV.
 * Columns: id,text,Not Toxic,Hard to Say,Toxic,Very Toxic,...
 * Values are annotator vote counts. A sentence is "toxic" if
 * Toxic + Very Toxic votes exceed Not Toxic votes.
 */
function parseToxicDatasetCsv(csvText: string): { toxic: string[]; clean: string[] } {
  const lines = csvText.split("\n");
  const header = lines[0];
  if (!header) {
    return { toxic: [], clean: [] };
  }

  // Find column indices
  const cols = header.split(",");
  const textIdx = cols.indexOf("text");
  const notToxicIdx = cols.indexOf("Not Toxic");
  const toxicIdx = cols.indexOf("Toxic");
  const veryToxicIdx = cols.indexOf("Very Toxic");

  if (textIdx === -1 || notToxicIdx === -1 || toxicIdx === -1) {
    console.warn("  Warning: unexpected CSV format, skipping NCD extraction");
    return { toxic: [], clean: [] };
  }

  const toxic: string[] = [];
  const clean: string[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) {
      continue;
    }
    // Simple CSV split (text field may be quoted)
    const fields = splitCsvLine(line);
    const text = fields[textIdx]?.replace(/^"|"$/g, "").replace(/""/g, '"') ?? "";
    const notToxicVotes = parseInt(fields[notToxicIdx] ?? "0", 10);
    const toxicVotes = parseInt(fields[toxicIdx] ?? "0", 10);
    const veryToxicVotes = parseInt(fields[veryToxicIdx] ?? "0", 10);

    if (isNaN(notToxicVotes) || isNaN(toxicVotes)) {
      continue;
    }

    const toxTotal = toxicVotes + veryToxicVotes;
    if (toxTotal > notToxicVotes && toxTotal >= 2) {
      toxic.push(text);
    } else if (notToxicVotes >= 3 && toxTotal === 0) {
      clean.push(text);
    }
  }

  return { toxic, clean };
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  const chars = [...line];
  const len = chars.length;
  const acc: string[] = [];
  // eslint-disable-next-line no-restricted-syntax
  for (let i = 0, inQuote = false; i < len; i++) {
    const ch = chars[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      fields.push(acc.join(""));
      acc.length = 0;
    } else {
      acc.push(ch);
    }
  }
  fields.push(acc.join(""));
  return fields;
}

// ============================================================
// Toxic: English (cuss)
// ============================================================

async function buildToxicEn(): Promise<void> {
  console.log("\n[toxic-en] Building...");

  const entries = new Map<string, { severity: number; category: ToxicCategory }>();

  for (const [word, sureness] of Object.entries(cuss)) {
    if (sureness < 1 || word.length < 2) {
      continue;
    }
    entries.set(word.toLowerCase(), {
      severity: sureness >= 2 ? 0.9 : 0.5,
      category: "profanity",
    });
  }

  const raw: GenericEntry<ToxicCategory>[] = [...entries].map(([word, { severity, category }]) => ({
    word,
    score: severity,
    category,
  }));

  const sorted = compressionSort(raw, (c) => TOXIC_CATEGORY_ORDER[c] ?? 0);
  const toxEntries: ToxicEntry[] = sorted.map((e) => ({ word: e.word, severity: e.score, category: e.category }));

  const binary = encodeToxicEntries(toxEntries, "en");
  writeBin("toxic-en.bin", binary, entries.size);
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log("=== Building all lexicon binaries ===");

  await Promise.all([buildSentimentJa(), buildSentimentEn(), buildToxicJa(), buildToxicEn()]);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
