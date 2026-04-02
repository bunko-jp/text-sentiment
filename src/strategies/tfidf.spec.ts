/**
 * @file Unit tests for TF-IDF classifier (tokens-based).
 */

import { classifyByTfidf } from "./tfidf";
import { getLexicon } from "../lexicons/index";
import { tokenizeText } from "../utils/tokenizer";

describe("classifyByTfidf", () => {
  it("returns neutral for empty tokens", () => {
    const lexicon = getLexicon("en");
    expect(classifyByTfidf([], lexicon).label).toBe("neutral");
  });

  it("gives higher positive score for positive text", () => {
    const lexicon = getLexicon("en");
    const posTokens = tokenizeText("wonderful excellent amazing beautiful superb", "en");
    const negTokens = tokenizeText("terrible horrible awful dreadful disgusting", "en");
    const posResult = classifyByTfidf(posTokens, lexicon);
    const negResult = classifyByTfidf(negTokens, lexicon);
    expect(posResult.scores.positive).toBeGreaterThan(negResult.scores.positive);
  });
});
