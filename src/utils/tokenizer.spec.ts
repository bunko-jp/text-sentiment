/**
 * @file Unit tests for tokenizer.
 */

import { tokenizeText } from "./tokenizer";

describe("tokenizeText", () => {
  it("returns empty array for empty string", () => {
    expect(tokenizeText("", "en")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(tokenizeText("   \n\t  ", "en")).toEqual([]);
  });

  it("tokenizes English text into words", () => {
    const tokens = tokenizeText("Hello World", "en");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
  });

  it("tokenizes Japanese text into word-level segments", () => {
    const tokens = tokenizeText("素晴らしい天気", "ja");
    expect(tokens).toContain("素晴らしい");
    expect(tokens).toContain("天気");
  });

  it("keeps katakana compound as single token", () => {
    const tokens = tokenizeText("プログラミングコンテスト", "ja");
    expect(tokens).toHaveLength(1);
  });

  it("normalizes to lowercase", () => {
    const tokens = tokenizeText("HELLO", "en");
    expect(tokens).toContain("hello");
  });

  it("strips punctuation from tokens", () => {
    const tokens = tokenizeText("最高！素晴らしい。", "ja");
    expect(tokens).toContain("最高");
    expect(tokens).toContain("素晴らしい");
    expect(tokens.some((t) => t === "！" || t === "。")).toBe(false);
  });
});
