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
