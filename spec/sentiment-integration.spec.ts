/**
 * @file Integration tests for sentiment analysis via analyze().
 */

import { analyze } from "../src/analyze";

const POSITIVE_EN =
  "This movie is absolutely wonderful and beautiful. An excellent masterpiece that I highly recommend.";
const NEGATIVE_EN =
  "This was a terrible experience. Awful service and horrible quality. Never going back.";
const POSITIVE_JA =
  "本当に素晴らしい作品です。美しい映像と見事な演出に感銘を受けました。絶対にお勧めです。";
const NEGATIVE_JA =
  "最悪の体験でした。酷いサービスで不快な思いをしました。残念で不満が残る。二度と行きたくない。";

describe("analyze: English sentiment", () => {
  it("positive (NB)", () => {
    expect(analyze(POSITIVE_EN, "en").sentiment.label).toBe("positive");
  });

  it("negative (NB)", () => {
    expect(analyze(NEGATIVE_EN, "en").sentiment.label).toBe("negative");
  });

  it("positive (ensemble)", () => {
    expect(analyze(POSITIVE_EN, "en", { ensemble: {} }).sentiment.label).toBe("positive");
  });

  it("negative (ensemble)", () => {
    expect(analyze(NEGATIVE_EN, "en", { ensemble: {} }).sentiment.label).toBe("negative");
  });
});

describe("analyze: Japanese sentiment", () => {
  it("positive (NB)", () => {
    expect(analyze(POSITIVE_JA, "ja").sentiment.label).toBe("positive");
  });

  it("negative (NB)", () => {
    expect(analyze(NEGATIVE_JA, "ja").sentiment.label).toBe("negative");
  });

  it("positive (ensemble)", () => {
    expect(analyze(POSITIVE_JA, "ja", { ensemble: {} }).sentiment.label).toBe("positive");
  });

  it("negative (ensemble)", () => {
    expect(analyze(NEGATIVE_JA, "ja", { ensemble: {} }).sentiment.label).toBe("negative");
  });
});

describe("analyze: edge cases", () => {
  it("empty text", () => {
    expect(analyze("", "en").sentiment.label).toBe("neutral");
  });

  it("whitespace only", () => {
    expect(analyze("   ", "ja").sentiment.label).toBe("neutral");
  });
});
