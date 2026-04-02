/**
 * @file Integration tests for Scunthorpe problem prevention.
 *
 * The segmenter keeps compound words as single tokens, so substrings
 * that happen to be offensive never become standalone tokens.
 *
 * English: Scunthorpe, cocktail, assassin, classic
 * Japanese: カスタマーサポート contains カス (slur) but is safe
 */

import { analyze } from "../src/analyze";
import { tokenizeText } from "../src/utils/tokenizer";

describe("Scunthorpe: English compounds stay intact", () => {
  const cases = [
    { text: "I live in Scunthorpe", word: "scunthorpe" },
    { text: "I ordered a cocktail", word: "cocktail" },
    { text: "Assassin's Creed is great", word: "assassin's" },
    { text: "This is a classic film", word: "classic" },
  ];

  for (const { text, word } of cases) {
    it(`"${word}" stays as single token → not toxic`, () => {
      expect(tokenizeText(text, "en")).toContain(word);
      expect(analyze(text, "en", { toxic: true }).toxic?.toxic).toBe(false);
    });
  }
});

describe("Scunthorpe: Japanese katakana compounds stay intact", () => {
  it("カスタマーサポート (contains カス) → single token → not toxic", () => {
    const tokens = tokenizeText("カスタマーサポートは素晴らしい", "ja");
    expect(tokens).toContain("カスタマーサポート");
    expect(tokens).not.toContain("カス");
    expect(analyze("カスタマーサポートは素晴らしい", "ja", { toxic: true }).toxic?.toxic).toBe(false);
  });

  it("standalone カス → toxic", () => {
    const r = analyze("あいつはカスだ", "ja", { toxic: true });
    expect(r.toxic?.toxic).toBe(true);
    expect(r.toxic?.matches[0].word).toBe("カス");
  });

  it("long katakana compounds stay as single token", () => {
    for (const compound of ["プログラミングコンテスト", "インターネットサービス"]) {
      expect(tokenizeText(compound, "ja")).toHaveLength(1);
    }
  });
});

describe("Scunthorpe: sentiment preserved with safe compounds", () => {
  it("cocktail party → positive", () => {
    const r = analyze(
      "The cocktail party was wonderful and excellent. A beautiful evening with great company.",
      "en"
    );
    expect(r.sentiment.label).toBe("positive");
  });

  it("カスタマーサポートが素晴らしい → positive", () => {
    const r = analyze(
      "カスタマーサポートが素晴らしい対応で感銘を受けました。本当に見事なサービスです。",
      "ja"
    );
    expect(r.sentiment.label).toBe("positive");
  });
});
