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
