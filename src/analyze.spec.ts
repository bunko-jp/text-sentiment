/**
 * @file Unit tests for the unified analyze() entry point.
 */

import { analyze } from "./analyze";

describe("analyze", () => {
  describe("sentiment (default: naive-bayes)", () => {
    it("classifies positive English text", () => {
      const r = analyze(
        "This movie is absolutely wonderful and beautiful. An excellent masterpiece.",
        "en"
      );
      expect(r.sentiment.label).toBe("positive");
      expect(r.tokens.length).toBeGreaterThan(0);
    });

    it("classifies negative English text", () => {
      const r = analyze(
        "Terrible experience. Awful service and horrible quality. Never going back.",
        "en"
      );
      expect(r.sentiment.label).toBe("negative");
    });

    it("classifies positive Japanese text", () => {
      const r = analyze(
        "本当に素晴らしい作品です。美しい映像と見事な演出に感銘を受けました。",
        "ja"
      );
      expect(r.sentiment.label).toBe("positive");
    });

    it("classifies negative Japanese text", () => {
      const r = analyze(
        "最悪の体験でした。酷いサービスで不快な思いをしました。二度と行きたくない。",
        "ja"
      );
      expect(r.sentiment.label).toBe("negative");
    });

    it("returns neutral for empty text", () => {
      expect(analyze("", "en").sentiment.label).toBe("neutral");
    });
  });

  describe("strategy selection", () => {
    it("uses tfidf when specified", () => {
      const r = analyze("wonderful excellent amazing", "en", { strategy: "tfidf" });
      expect(r.sentiment.scores.positive).toBeDefined();
    });

    it("uses ncd when specified", () => {
      const r = analyze("wonderful excellent amazing", "en", { strategy: "ncd" });
      expect(r.sentiment).toBeDefined();
    });
  });

  describe("ensemble", () => {
    it("runs ensemble when options.ensemble is set", () => {
      const r = analyze(
        "This movie is absolutely wonderful and beautiful. An excellent masterpiece.",
        "en",
        { ensemble: {} }
      );
      expect(r.sentiment.label).toBe("positive");
    });
  });

  describe("toxic detection", () => {
    it("flags toxic content when enabled", () => {
      // "damn" — mild profanity, present in cuss lexicon
      const r = analyze("damn this thing", "en", { toxic: true });
      expect(r.toxic).toBeDefined();
      expect(r.toxic?.toxic).toBe(true);
    });

    it("clean text passes", () => {
      const r = analyze("The cocktail party was wonderful", "en", { toxic: true });
      expect(r.toxic?.toxic).toBe(false);
    });

    it("omits toxic when not requested", () => {
      expect(analyze("damn", "en").toxic).toBeUndefined();
    });
  });

  describe("category breakdown", () => {
    it("includes categories when requested", () => {
      const r = analyze(
        "本当に素晴らしい作品です。美しい映像と見事な演出に感銘を受けました。",
        "ja",
        { categories: true }
      );
      expect(r.categories).toBeDefined();
    });

    it("omits categories when not requested", () => {
      expect(analyze("素晴らしい", "ja").categories).toBeUndefined();
    });
  });
});
