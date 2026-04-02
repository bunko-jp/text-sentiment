/**
 * @file Test setup: load binary lexicon data and register before tests run.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { registerLexiconFromBinary, registerToxicLexiconFromBinary } from "../src/lexicons/index";

const DATA_DIR = resolve(__dirname, "../src/data");

function loadAndRegister(type: "sentiment" | "toxic", language: string): void {
  const binPath = resolve(DATA_DIR, `${type}-${language}.bin`);
  const data = new Uint8Array(readFileSync(binPath));
  if (type === "sentiment") {
    registerLexiconFromBinary(language, data);
  } else {
    registerToxicLexiconFromBinary(language, data);
  }
}

// Register all available lexicons
loadAndRegister("sentiment", "en");
loadAndRegister("sentiment", "ja");
loadAndRegister("toxic", "en");
loadAndRegister("toxic", "ja");
