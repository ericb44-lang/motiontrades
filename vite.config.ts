import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  server: { port: 3000 },
  resolve: {
    // One copy of React and the router, always.
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // src/server.ts wraps the server entry with a friendly error page.
      server: { entry: "server" },
    }),
    // Nitro packages the app as a standalone Node server (.output/server/index.mjs).
    ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
    viteReact(),
  ],
  // Pre-bundle every UI dependency up front. Discovering them lazily makes Vite
  // re-optimize mid-session, which can load two React copies (blank screen in dev).
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "sonner",
      "lucide-react",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
      "@radix-ui/react-slot",
      "@radix-ui/react-dialog",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-label",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-tabs",
      "@radix-ui/react-checkbox",
    ],
  },
}));
