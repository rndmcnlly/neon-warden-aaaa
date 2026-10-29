/** Isolated dev harness: do not reload when concurrent workers write assets. */
export default {
  root: new URL("../../", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 5188,
    strictPort: true,
    hmr: false,
    watch: { ignored: ["**/*"] },
  },
};
