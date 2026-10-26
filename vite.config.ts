import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Nitro detects the host (Vercel, Netlify, Cloudflare...) during the build.
// To force one, set NITRO_PRESET (e.g. "vercel", "netlify", "node-server").
export default defineConfig({
  server: { port: 3000 },
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    // Use src/server.ts (SSR error wrapper) as the server entry.
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    viteReact(),
  ],
});
