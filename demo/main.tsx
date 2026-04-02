import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerLexiconFromBinary, registerToxicLexiconFromBinary } from "../src/lexicons/index";

async function loadBin(path: string): Promise<Uint8Array> {
  const res = await fetch(path);
  return new Uint8Array(await res.arrayBuffer());
}

async function boot(): Promise<void> {
  // Load all lexicon binaries from public dir (served by Vite)
  const [sentJa, sentEn, toxJa, toxEn] = await Promise.all([
    loadBin("/sentiment-ja.bin"),
    loadBin("/sentiment-en.bin"),
    loadBin("/toxic-ja.bin"),
    loadBin("/toxic-en.bin"),
  ]);

  registerLexiconFromBinary("ja", sentJa);
  registerLexiconFromBinary("en", sentEn);
  registerToxicLexiconFromBinary("ja", toxJa);
  registerToxicLexiconFromBinary("en", toxEn);

  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(<App />);
  }
}

boot();
