/**
 * @file Unit tests for Naive Bayes classifier (tokens-based).
 */

import { classifyByNaiveBayes } from "./naive-bayes";
import { getLexicon } from "../lexicons/index";
import { tokenizeText } from "../utils/tokenizer";

describe("classifyByNaiveBayes", () => {
  it("returns neutral for empty tokens", () => {
    const lexicon = getLexicon("en");
    const result = classifyByNaiveBayes([], lexicon);
    expect(result.label).toBe("neutral");
  });

  it("classifies positive English tokens", () => {
    const lexicon = getLexicon("en");
    const tokens = tokenizeText("This is absolutely wonderful and beautiful, an excellent masterpiece", "en");
    const result = classifyByNaiveBayes(tokens, lexicon);
    expect(result.label).toBe("positive");
  });

  it("classifies negative English tokens", () => {
    const lexicon = getLexicon("en");
    const tokens = tokenizeText("Terrible experience, awful service, horrible quality", "en");
    const result = classifyByNaiveBayes(tokens, lexicon);
    expect(result.label).toBe("negative");
  });

  it("classifies positive Japanese tokens", () => {
    const lexicon = getLexicon("ja");
    const tokens = tokenizeText("本当に素晴らしい作品です。美しい映像と見事な演出に感銘を受けました。", "ja");
    const result = classifyByNaiveBayes(tokens, lexicon);
    expect(result.label).toBe("positive");
  });

  it("classifies negative Japanese tokens", () => {
    const lexicon = getLexicon("ja");
    const tokens = tokenizeText("最悪の体験でした。酷いサービスで不快な思いをしました。", "ja");
    const result = classifyByNaiveBayes(tokens, lexicon);
    expect(result.label).toBe("negative");
  });
});
