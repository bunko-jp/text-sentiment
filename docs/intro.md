# @bunkojp/text-sentiment

Multilingual sentiment analysis with Scunthorpe-safe tokenization.

- **Multiple strategies** — Naive Bayes (primary), TF-IDF, NCD, and weighted ensemble
- **Toxic content detection** — offensive word matching that never flags safe compound words
- **No server required** — runs entirely in-process (Node, Bun, or browser)
- **Data-driven** — all lexicons loaded from pre-built compressed binaries, no hardcoded word lists in source
