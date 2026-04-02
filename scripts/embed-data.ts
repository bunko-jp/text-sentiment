/**
 * @file Generate one .ts per .bin in src/data/ for tree-shakeable imports.
 *
 * Output: src/data/sentiment-ja.ts, src/data/sentiment-en.ts, etc.
 * Each exports a single function returning Uint8Array from base64.
 *
 * Usage: bun run scripts/embed-data.ts
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_DIR = resolve(import.meta.dir, "../src/data");

const bins = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith(".bin"))
  .sort();

for (const bin of bins) {
  const name = bin.replace(".bin", "");
  const b64 = readFileSync(resolve(DATA_DIR, bin)).toString("base64");
  const ts = resolve(DATA_DIR, `${name}.ts`);

  const content = [
    "/** @file Auto-generated. DO NOT EDIT — regenerate with: bun run build:data */",
    "const d = (b: string): Uint8Array => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));",
    `const b = "${b64}";`,
    `export default (): Uint8Array => d(b);`,
    "",
  ].join("\n");

  writeFileSync(ts, content);
  console.log(`  ${name}.ts (${b64.length} chars)`);
}

console.log(`Done. ${bins.length} files generated.`);
