# @bunkojp/text-sentiment

Multilingual sentiment analysis with Scunthorpe-safe tokenization.

- **Multiple strategies** — Naive Bayes (primary), TF-IDF, NCD, and weighted ensemble
- **Toxic content detection** — offensive word matching that never flags safe compound words
- **No server required** — runs entirely in-process (Node, Bun, or browser)
- **Data-driven** — all lexicons loaded from pre-built compressed binaries, no hardcoded word lists in source


## Overview

### Architecture

```
analyze(text, language, options?)
  |
  +-- tokenizeText(text, language)       <- Single Source of Truth
  |     |
  |     +-- JA: mikan.js-style segmenter (character-class boundaries)
  |     +-- EN: whitespace split + punctuation strip
  |
  +-- tokens -> classifyByNaiveBayes()   <- pre-trained model from binary
  +-- tokens -> classifyByTfidf()
  +-- tokens -> classifyByNcd()
  +-- tokens -> toxic detection (exact token match)
  +-- tokens -> category breakdown (lexicon lookup)
```

### Scunthorpe Problem Prevention

The Japanese segmenter splits text at character-class transitions (kanji / hiragana / katakana / latin). Katakana compound words stay as single tokens, so offensive substrings embedded within them are never produced as independent tokens.

For English, standard whitespace tokenization already keeps compound words like "Scunthorpe" and "cocktail" intact.

### Data Format

All lexicon data is stored as compressed MessagePack binaries in `src/data/`:

| Optimization | Effect |
|---|---|
| Columnar layout | words[], scores[], categories[] stored separately |
| Score delta encoding | sorted scores have small consecutive differences |
| NB palette indexing | log-likelihood triplets compressed to palette + uint8 index |
| Category enum | string categories mapped to uint8 |
| deflate level 9 | maximum compression |

### Supported Languages

| Language | Sentiment Lexicon | Toxic Lexicon |
|---|---|---|
| Japanese (ja) | 11,293 words (Tohoku Univ. via oseti) | 748 words |
| English (en) | 8,219 words (AFINN + VADER) | 1,540 words (cuss) |

Adding a new language requires only running the build script with new corpus URLs — no code changes.


## Getting Started

### Quick Start (Node / Bun)

```ts
import { readFileSync } from "node:fs";
import { analyze, registerLexiconFromBinary, registerToxicLexiconFromBinary } from "@bunkojp/text-sentiment";

// Load lexicon binaries (once at startup)
registerLexiconFromBinary("ja", new Uint8Array(readFileSync("node_modules/@bunkojp/text-sentiment/src/data/sentiment-ja.bin")));
registerLexiconFromBinary("en", new Uint8Array(readFileSync("node_modules/@bunkojp/text-sentiment/src/data/sentiment-en.bin")));
registerToxicLexiconFromBinary("ja", new Uint8Array(readFileSync("node_modules/@bunkojp/text-sentiment/src/data/toxic-ja.bin")));
registerToxicLexiconFromBinary("en", new Uint8Array(readFileSync("node_modules/@bunkojp/text-sentiment/src/data/toxic-en.bin")));

// Analyze
const result = analyze("This movie is absolutely wonderful.", "en");
console.log(result.sentiment.label);      // "positive"
console.log(result.sentiment.confidence);  // 0.95
```

### Quick Start (Browser)

```ts
import { analyze, registerLexiconFromBinary, registerToxicLexiconFromBinary } from "@bunkojp/text-sentiment";

// Fetch and register binaries
const data = await fetch("/sentiment-en.bin").then(r => r.arrayBuffer());
registerLexiconFromBinary("en", new Uint8Array(data));

const result = analyze("Terrible experience.", "en");
console.log(result.sentiment.label); // "negative"
```


## Usage

### Basic Sentiment Analysis

```ts
// Default: Naive Bayes
analyze("素晴らしい作品です", "ja")
// { sentiment: { label: "positive", confidence: 0.94, scores: {...} }, tokens: [...] }

// Select strategy
analyze("Great product", "en", { strategy: "tfidf" })
analyze("Great product", "en", { strategy: "ncd" })
```

### Ensemble

Weighted combination of all three strategies:

```ts
analyze("素晴らしい作品です", "ja", { ensemble: {} })
// Default weights: naive-bayes 0.6, tfidf 0.25, ncd 0.15

// Custom weights
analyze("text", "en", {
  ensemble: {
    strategies: ["naive-bayes", "tfidf"],
    weights: { "naive-bayes": 0.7, "tfidf": 0.3 },
  },
})
```

### Toxic Content Detection

```ts
const r = analyze("text", "ja", { toxic: true });
r.toxic?.toxic     // boolean
r.toxic?.matches   // [{ word, severity, category }]
```

### Per-Category Breakdown

```ts
const r = analyze("text", "ja", { categories: true });
r.categories
// { general: { label, confidence, scores }, quality: {...}, ... }
```

Categories: `general`, `quality`, `service`, `price`, `usability`, `emotion`, `appearance`

### All Options Combined

```ts
analyze("text", "ja", {
  strategy: "naive-bayes",
  ensemble: { weights: { "naive-bayes": 0.6, tfidf: 0.25, ncd: 0.15 } },
  categories: true,
  toxic: true,
  smoothing: 1,
  neutralThreshold: 0.05,
})
```

### Low-Level API

For direct access to individual classifiers:

```ts
import { tokenizeText, classifyByNaiveBayes, getLexicon } from "@bunkojp/text-sentiment";

const tokens = tokenizeText("text", "ja");
const lexicon = getLexicon("ja");
const result = classifyByNaiveBayes(tokens, lexicon);
```


## Installation

```bash
npm install @bunkojp/text-sentiment
# or
bun add @bunkojp/text-sentiment
```

### Building from Source

```bash
git clone https://github.com/bunko-jp/text-sentiment.git
cd text-sentiment
bun install
bun run build:data   # Download corpora and build lexicon binaries
bun run build        # Build library
bun run test         # Run tests
```

### Rebuilding Lexicon Data

The lexicon binaries in `src/data/` are pre-built and included in the package. To rebuild from external corpora:

```bash
bun run build:data
```

This downloads from:
- Tohoku University sentiment dictionary (via [oseti](https://github.com/ikegami-yukino/oseti))
- [AFINN-165](https://github.com/fnielsen/afinn) + [VADER](https://github.com/cjhutto/vaderSentiment)
- [inappropriate-words-ja](https://github.com/MosasoM/inappropriate-words-ja) + [LDNOOBW V2](https://github.com/LDNOOBWV2/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words_V2)
- [words/cuss](https://github.com/words/cuss)

See [THIRD-PARTY-LICENSES](THIRD-PARTY-LICENSES) for full license details.

### Demo

```bash
bun run demo
# Opens http://localhost:5173 with a React-based interactive demo
```


## License

CC0-1.0 - see [LICENSE](LICENSE) for details.
