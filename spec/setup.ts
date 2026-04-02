/**
 * @file Test setup: register embedded lexicon data before tests run.
 */

import { registerLexiconFromBinary, registerToxicLexiconFromBinary } from "../src/lexicons/index";
import loadSentimentEn from "../src/data/sentiment-en";
import loadSentimentJa from "../src/data/sentiment-ja";
import loadToxicEn from "../src/data/toxic-en";
import loadToxicJa from "../src/data/toxic-ja";

registerLexiconFromBinary("en", loadSentimentEn());
registerLexiconFromBinary("ja", loadSentimentJa());
registerToxicLexiconFromBinary("en", loadToxicEn());
registerToxicLexiconFromBinary("ja", loadToxicJa());
