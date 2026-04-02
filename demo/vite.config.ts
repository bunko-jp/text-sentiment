/**
 * @file Vite config for demo frontend.
 */

import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  server: {
    port: 5173,
    open: true,
  },
});
