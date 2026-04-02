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
