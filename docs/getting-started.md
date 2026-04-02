## Getting Started

```ts
import { analyze, registerLexiconFromBinary, registerToxicLexiconFromBinary } from "@bunkojp/text-sentiment";
import loadSentimentJa from "@bunkojp/text-sentiment/data/sentiment-ja";
import loadToxicJa from "@bunkojp/text-sentiment/data/toxic-ja";

// Register data (once at startup — tree-shakeable per language)
registerLexiconFromBinary("ja", loadSentimentJa());
registerToxicLexiconFromBinary("ja", loadToxicJa());

// Analyze
const result = analyze("素晴らしい作品です", "ja", { toxic: true });
console.log(result.sentiment.label);  // "positive"
console.log(result.toxic?.toxic);     // false
```

No fs, no fetch, no path resolution. Works in Node, Bun, and browser.
Only the languages you import are included in your bundle.
