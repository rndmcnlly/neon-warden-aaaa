/** Isolated dev server for iteration: no reloads when concurrent workers write. */
export default {
  root: new URL("../../", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 5189,
    strictPort: true,
    hmr: false,
    watch: { ignored: ["**/*"] },
  },
};
