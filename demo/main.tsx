import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerLexiconFromBinary, registerToxicLexiconFromBinary } from "../src/lexicons/index";
import loadSentimentJa from "../src/data/sentiment-ja";
import loadSentimentEn from "../src/data/sentiment-en";
import loadToxicJa from "../src/data/toxic-ja";
import loadToxicEn from "../src/data/toxic-en";

registerLexiconFromBinary("ja", loadSentimentJa());
registerLexiconFromBinary("en", loadSentimentEn());
registerToxicLexiconFromBinary("ja", loadToxicJa());
registerToxicLexiconFromBinary("en", loadToxicEn());

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
