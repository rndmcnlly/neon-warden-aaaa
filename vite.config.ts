import { offlinePlugin } from "./src/platform/build.ts";

// https://vite.dev/config/
export default {
  plugins: [offlinePlugin()],
  // A hosted build under a subpath (for example a GitHub Pages repository)
  // supplies its name here; local development serves from the root.
  base: Deno.env.get("REPO_NAME") ? `/${Deno.env.get("REPO_NAME")}/` : "/",
  server: {
    port: 3000,
    open: true,
  },
  // Phone testing over `tailscale serve`: allow tailnet hostnames (private
  // to Adam's tailnet; HTTPS there also lets the service worker register).
  preview: {
    allowedHosts: [".ts.net"],
  },
  build: {
    target: "esnext",
    outDir: "dist",
    sourcemap: true,
    // three.js alone is larger than the default 500 kB warning threshold.
    chunkSizeWarningLimit: 2000,
  },
};
