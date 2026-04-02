/**
 * @file Unit tests for lexicon loading from binary data.
 */

import { getLexicon, getToxicLexicon, supportedLanguages, scoreLexicon } from "./index";

describe("getLexicon", () => {
  it("returns English lexicon with entries", () => {
    const lexicon = getLexicon("en");
    expect(lexicon.language).toBe("en");
    expect(lexicon.entries.size).toBeGreaterThan(1000);
  });

  it("returns Japanese lexicon with entries", () => {
    const lexicon = getLexicon("ja");
    expect(lexicon.language).toBe("ja");
    expect(lexicon.entries.size).toBeGreaterThan(1000);
  });

  it("throws for unsupported language", () => {
    expect(() => getLexicon("zz")).toThrow("No sentiment lexicon");
  });

  it("caches lexicon instances", () => {
    const a = getLexicon("en");
    const b = getLexicon("en");
    expect(a).toBe(b);
  });
});

describe("getToxicLexicon", () => {
  it("returns English toxic lexicon", () => {
    const lexicon = getToxicLexicon("en");
    expect(lexicon.entries.size).toBeGreaterThan(100);
  });

  it("returns Japanese toxic lexicon", () => {
    const lexicon = getToxicLexicon("ja");
    expect(lexicon.entries.size).toBeGreaterThan(100);
  });
});

describe("supportedLanguages", () => {
  it("returns en and ja", () => {
    const langs = supportedLanguages();
    expect(langs).toContain("en");
    expect(langs).toContain("ja");
  });
});

describe("scoreLexicon", () => {
  it("returns non-zero for known positive words", () => {
    const lexicon = getLexicon("en");
    const result = scoreLexicon(["wonderful", "excellent"], lexicon);
    expect(result.sum).toBeGreaterThan(0);
    expect(result.count).toBeGreaterThan(0);
  });

  it("returns zero for unmatched tokens", () => {
    const lexicon = getLexicon("en");
    const result = scoreLexicon(["xyznotaword123"], lexicon);
    expect(result.sum).toBe(0);
    expect(result.count).toBe(0);
  });
});
