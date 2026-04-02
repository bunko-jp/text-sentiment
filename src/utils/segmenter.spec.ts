/**
 * @file Unit tests for Japanese text segmenter.
 */

import { segmentJapanese, segmentText } from "./segmenter";

describe("segmentJapanese", () => {
  describe("character-class splitting", () => {
    it("keeps katakana runs as one token", () => {
      expect(segmentJapanese("カタカナ")).toEqual(["カタカナ"]);
    });

    it("splits kanji from particles", () => {
      expect(segmentJapanese("最高の作品")).toEqual(["最高", "の", "作品"]);
    });

    it("splits katakana from particles and kanji", () => {
      expect(segmentJapanese("アニメは最高の作品")).toEqual(["アニメ", "は", "最高", "の", "作品"]);
    });
  });

  describe("okurigana merging", () => {
    it("merges hiragana okurigana with preceding kanji", () => {
      expect(segmentJapanese("美しい")).toEqual(["美しい"]);
    });

    it("merges kanji + okurigana and splits trailing particle", () => {
      const result = segmentJapanese("美しいが高い");
      expect(result).toContain("美しい");
      expect(result).toContain("が");
      expect(result).toContain("高い");
    });

    it("handles 楽しい correctly", () => {
      expect(segmentJapanese("楽しい")).toEqual(["楽しい"]);
    });

    it("handles 素晴らしい correctly", () => {
      expect(segmentJapanese("素晴らしい")).toEqual(["素晴らしい"]);
    });
  });

  describe("long katakana compounds stay intact", () => {
    it("preserves long katakana compound as single token", () => {
      expect(segmentJapanese("プログラミングコンテスト")).toEqual(["プログラミングコンテスト"]);
    });
  });

  describe("display mode", () => {
    it("merges particles with preceding word in display mode", () => {
      const result = segmentJapanese("本を読む", "display");
      expect(result[0]).toBe("本を");
    });
  });
});

describe("segmentText", () => {
  it("uses Japanese segmenter for ja", () => {
    const result = segmentText("アニメは最高", "ja");
    expect(result).toContain("アニメ");
    expect(result).toContain("最高");
  });

  it("uses whitespace splitting for en", () => {
    expect(segmentText("This is great", "en")).toEqual(["This", "is", "great"]);
  });

  it("strips punctuation in English", () => {
    const result = segmentText("Great! Amazing.", "en");
    expect(result).toContain("Great");
    expect(result).toContain("Amazing");
  });
});
