/**
 * @file Japanese text segmenter using character-class boundary detection.
 *
 * Inspired by mikan.js: splits Japanese text at character-type transitions
 * (kanji/hiragana/katakana/latin/digit/punctuation), then applies
 * grammatical merging rules (particles attach to preceding word,
 * hiragana okurigana merges with preceding kanji).
 *
 * This approach solves the Scunthorpe problem structurally:
 * Katakana compound words stay as single tokens, preventing
 * Scunthorpe-class false positives structurally.
 */

// ============================================================
// Character-class patterns
// ============================================================

/** Kanji (CJK Unified Ideographs + common variants) */
const RE_KANJI = /[一-龠々〆ヵヶ]/;

/** Hiragana */
const RE_HIRAGANA = /[ぁ-んゝ]/;

/** Katakana (including prolonged sound mark ー) */
const RE_KATAKANA = /[ァ-ヴー]/;

/** ASCII alphanumeric */
const RE_ALNUM = /[a-zA-Z0-9]/;

/** Full-width alphanumeric */
const RE_FULLWIDTH_ALNUM = /[ａ-ｚＡ-Ｚ０-９]/;

/** Punctuation and whitespace (split boundary) */
const RE_PUNCT = /[\s\p{P}\p{S}]/u;

/**
 * Japanese particles (助詞) — used for merge decisions.
 * Sorted by length descending so longer patterns match first.
 */
const PARTICLES: readonly string[] = [
  "でなければ",
  "について",
  "ながら",
  "ばかり",
  "けれど",
  "くらい",
  "なのか",
  "ことよ",
  "かしら",
  "こそ",
  "こと",
  "さえ",
  "しか",
  "した",
  "たり",
  "だけ",
  "だに",
  "だの",
  "つつ",
  "ても",
  "てよ",
  "でも",
  "とも",
  "から",
  "など",
  "なり",
  "ので",
  "のに",
  "ほど",
  "まで",
  "もの",
  "やら",
  "より",
  "って",
  "で",
  "と",
  "な",
  "に",
  "ね",
  "の",
  "も",
  "は",
  "ば",
  "へ",
  "や",
  "わ",
  "を",
  "か",
  "が",
  "さ",
  "し",
  "ぞ",
  "て",
];

/** Particles that should NOT trigger merging with the preceding token when they stand alone */
const STANDALONE_PARTICLES = new Set(["と", "の", "に"]);

// ============================================================
// Character classification
// ============================================================

const enum CharType {
  Kanji = 0,
  Hiragana = 1,
  Katakana = 2,
  Alnum = 3,
  Punct = 4,
  Other = 5,
}

function classifyChar(ch: string): CharType {
  if (RE_KANJI.test(ch)) {
    return CharType.Kanji;
  }
  if (RE_HIRAGANA.test(ch)) {
    return CharType.Hiragana;
  }
  if (RE_KATAKANA.test(ch)) {
    return CharType.Katakana;
  }
  if (RE_ALNUM.test(ch) || RE_FULLWIDTH_ALNUM.test(ch)) {
    return CharType.Alnum;
  }
  if (RE_PUNCT.test(ch)) {
    return CharType.Punct;
  }
  return CharType.Other;
}

// ============================================================
// Phase 1: Split at character-class boundaries
// ============================================================

function splitByCharType(text: string): string[] {
  if (text.length === 0) {
    return [];
  }

  const chars = [...text];
  const segments: string[] = [];
  const firstChar = chars[0];
  const initial = { current: firstChar, type: classifyChar(firstChar) };

  const result = chars.slice(1).reduce(
    (acc, ch) => {
      const type = classifyChar(ch);
      if (type !== acc.type) {
        segments.push(acc.current);
        return { current: ch, type };
      }
      return { current: acc.current + ch, type: acc.type };
    },
    initial
  );
  segments.push(result.current);

  return segments.filter((s) => s.length > 0);
}

// ============================================================
// Phase 2: Merge based on grammatical rules
// ============================================================

function isParticle(token: string): boolean {
  return PARTICLES.includes(token);
}

function isHiraganaOnly(token: string): boolean {
  return [...token].every((ch) => RE_HIRAGANA.test(ch));
}

function isKanjiStarting(token: string): boolean {
  return token.length > 0 && RE_KANJI.test(token[0]);
}

function isPunct(token: string): boolean {
  return [...token].every((ch) => RE_PUNCT.test(ch));
}

/**
 * Merge tokens for display purposes (mikan.js compatible):
 * particles and punctuation attach to preceding word.
 */
function mergeTokensForDisplay(tokens: string[]): string[] {
  if (tokens.length <= 1) {
    return tokens;
  }

  return tokens.reduce<string[]>((result, token) => {
    if (result.length === 0) {
      return [token];
    }

    const prev = result[result.length - 1];

    // Hiragana okurigana merges with preceding kanji
    if (isHiraganaOnly(token) && isKanjiStarting(prev) && !isParticle(token)) {
      result[result.length - 1] = prev + token;
      return result;
    }

    // Particle merges with preceding word
    if (isParticle(token) && !isPunct(prev) && !STANDALONE_PARTICLES.has(token)) {
      result[result.length - 1] = prev + token;
      return result;
    }

    // Punctuation attaches to preceding word
    if (isPunct(token) && result.length > 0) {
      result[result.length - 1] = prev + token;
      return result;
    }

    result.push(token);
    return result;
  }, []);
}

/**
 * Split a hiragana token into okurigana + trailing particle(s).
 *
 * e.g. "しいが" → ["しい", "が"]
 *      "しい" → ["しい"]
 *      "です" → ["です"]  (です is not a particle but a copula — treated as okurigana)
 */
function splitTrailingParticle(hiragana: string): string[] {
  // Try longest particle match at the end
  for (const particle of PARTICLES) {
    if (hiragana.endsWith(particle) && hiragana.length > particle.length) {
      const okurigana = hiragana.slice(0, -particle.length);
      if (okurigana.length > 0) {
        return [okurigana, particle];
      }
    }
  }
  return [hiragana];
}

/**
 * Merge tokens for analysis purposes:
 * only okurigana merges with preceding kanji (for lexicon matching).
 * Particles and punctuation stay separate.
 * Trailing particles in okurigana are split off.
 */
function mergeTokensForAnalysis(tokens: string[]): string[] {
  if (tokens.length <= 1) {
    return tokens;
  }

  return tokens.reduce<string[]>((result, token) => {
    if (result.length === 0) {
      return [token];
    }

    const prev = result[result.length - 1];

    // Hiragana okurigana merges with preceding kanji
    // But first split off any trailing particle: "しいが" → "しい" + "が"
    if (isHiraganaOnly(token) && isKanjiStarting(prev) && !isParticle(token)) {
      const parts = splitTrailingParticle(token);
      result[result.length - 1] = prev + parts[0];
      if (parts.length > 1) {
        result.push(parts[1]);
      }
      return result;
    }

    result.push(token);
    return result;
  }, []);
}

// ============================================================
// Public API
// ============================================================

/**
 * Segment Japanese text into word-level tokens for analysis.
 *
 * Uses character-class boundary detection followed by okurigana merging.
 * Particles and punctuation remain separate tokens for accurate lexicon matching.
 *
 * This approach is lightweight (no dictionary required) and naturally prevents
 * Scunthorpe-class false positives: katakana compounds are kept as
 * single tokens and never split into offensive substrings.
 *
 * @param text - Japanese text to segment
 * @param mode - "analysis" (default) keeps particles separate; "display" merges them
 * @returns Array of word-level tokens
 */
export function segmentJapanese(text: string, mode: "analysis" | "display" = "analysis"): string[] {
  const rawTokens = splitByCharType(text);
  return mode === "display" ? mergeTokensForDisplay(rawTokens) : mergeTokensForAnalysis(rawTokens);
}

/**
 * Segment text with language awareness.
 * For Japanese, uses mikan-style segmentation.
 * For other languages, splits on whitespace/punctuation (standard word tokenization).
 *
 * @param text - Text to segment
 * @param language - Language code ("ja", "en", etc.)
 * @returns Array of word-level tokens
 */
export function segmentText(text: string, language: string): string[] {
  if (language === "ja") {
    return segmentJapanese(text);
  }
  // English and other languages: split on whitespace, then strip punctuation
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[\p{P}]+|[\p{P}]+$/gu, ""))
    .filter((w) => w.length > 0);
}
