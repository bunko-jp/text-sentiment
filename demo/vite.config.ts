/**
 * @file Vite config for demo frontend.
 *
 * Serves .bin files from src/data/ as static assets.
 */

import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  publicDir: "../src/data",
  server: {
    port: 5173,
    open: true,
  },
});
