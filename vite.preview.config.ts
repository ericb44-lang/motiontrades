// Builds preview/dist/index.html: the whole app in one self-contained HTML file.
// Run: npm run build:preview
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "preview",
  base: "./",
  publicDir: false,
  plugins: [tsConfigPaths({ root: ".." }), tailwindcss(), viteReact(), viteSingleFile()],
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router"] },
  build: { outDir: "dist", emptyOutDir: true, minify: process.env.NOMIN ? false : true },
});
