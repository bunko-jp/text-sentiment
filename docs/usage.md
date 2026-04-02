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
