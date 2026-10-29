import { offlinePlugin } from "./src/platform/build.ts";

const repoName = Deno.env.get("REPO_NAME");

// Where the landing page's "Read the source" links point.
// TODO(public-repo audit): confirm the public repository's owner and name.
const REPO_URL = Deno.env.get("REPO_URL") ??
  `https://github.com/rndmcnlly/${repoName ?? "neon-warden-aaaa"}`;

/** A short build line for the landing page footer: revision when known. */
function buildStamp(): string {
  const date = new Date().toISOString().slice(0, 10);
  try {
    const out = new Deno.Command("git", {
      args: ["rev-parse", "--short", "HEAD"],
      stderr: "null",
    }).outputSync();
    const rev = new TextDecoder().decode(out.stdout).trim();
    if (out.success && rev) return `Build ${rev}, ${date}`;
  } catch { /* a git archive has no .git: date only */ }
  return `Build ${date}`;
}

/** Fills `%REPO_URL%` and `%BUILD_STAMP%` in the HTML pages. */
function landingPlaceholders() {
  const stamp = buildStamp();
  return {
    name: "neon-landing-placeholders",
    transformIndexHtml: (html: string) =>
      html.replaceAll("%REPO_URL%", REPO_URL).replaceAll(
        "%BUILD_STAMP%",
        stamp,
      ),
  };
}

// https://vite.dev/config/
export default {
  plugins: [offlinePlugin(), landingPlaceholders()],
  // A hosted build under a subpath (for example a GitHub Pages repository)
  // supplies its name here; local development serves from the root.
  base: repoName ? `/${repoName}/` : "/",
  // Two pages: the landing page at the site root and the game at play/.
  appType: "mpa",
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
    rolldownOptions: {
      // Entry names become asset names (assets/landing-*.js), which is how
      // src/platform/build.ts keeps the landing page out of the offline pack.
      input: { landing: "index.html", play: "play/index.html" },
    },
  },
};
