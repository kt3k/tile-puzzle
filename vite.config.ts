import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  build: {
    codeSplitting: false,
    modulePreload: { polyfill: false },
  },
  plugins: [
    {
      name: "inline-script",
      closeBundle() {
        const distDir = resolve(__dirname, "dist");
        const htmlPath = resolve(distDir, "index.html");
        let html = readFileSync(htmlPath, "utf-8");

        // Find script tags referencing local assets and inline them
        html = html.replace(
          /<script type="module" crossorigin src="\.\/(assets\/[^"]+)"><\/script>/g,
          (_match, assetPath) => {
            const jsPath = resolve(distDir, assetPath);
            const jsCode = readFileSync(jsPath, "utf-8");
            return `<script type="module">\n${jsCode}</script>`;
          },
        );

        const { writeFileSync, rmSync } = require("node:fs");
        writeFileSync(htmlPath, html);
        // Remove assets directory
        rmSync(resolve(distDir, "assets"), { recursive: true, force: true });
      },
    },
  ],
});
