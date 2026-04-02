/**
 * @file Unit tests for NCD classifier (tokens-based).
 */

import { classifyByNcd } from "./ncd";
import { getLexicon } from "../lexicons/index";

describe("classifyByNcd", () => {
  it("returns neutral for empty tokens", () => {
    const lexicon = getLexicon("en");
    expect(classifyByNcd([], lexicon).label).toBe("neutral");
  });

  it("returns valid scores structure", () => {
    const lexicon = getLexicon("en");
    const result = classifyByNcd(["love", "wonderful", "great"], lexicon);
    expect(result.scores.positive).toBeDefined();
    expect(result.scores.negative).toBeDefined();
    expect(result.scores.neutral).toBeDefined();
  });
});
