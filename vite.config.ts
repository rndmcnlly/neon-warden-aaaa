// https://vite.dev/config/
export default {
  // A hosted build under a subpath (for example a GitHub Pages repository)
  // supplies its name here; local development serves from the root.
  base: Deno.env.get("REPO_NAME") ? `/${Deno.env.get("REPO_NAME")}/` : "/",
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: "esnext",
    outDir: "dist",
    sourcemap: true,
    // three.js alone is larger than the default 500 kB warning threshold.
    chunkSizeWarningLimit: 2000,
  },
};
