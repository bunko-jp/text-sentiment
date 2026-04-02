/**
 * @file Vite build configuration
 */

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      exclude: ["**/*.spec.ts"],
    }),
  ],
  build: {
    outDir: "dist",
    lib: {
      entry: {
        index: "src/index.ts",
        "data/sentiment-ja": "src/data/sentiment-ja.ts",
        "data/sentiment-en": "src/data/sentiment-en.ts",
        "data/toxic-ja": "src/data/toxic-ja.ts",
        "data/toxic-en": "src/data/toxic-en.ts",
      },
      formats: ["cjs", "es"],
    },
    rollupOptions: {
      external: [/node:.+/, "@msgpack/msgpack", "fflate"],
    },
  },
});
