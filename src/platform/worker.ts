/// <reference lib="webworker" />
/** No implicit download or activation: installation is not offline readiness. */
type Release = {
  version: string;
  files: { url: string; bytes: number; hash: string; lang: string | null }[];
};
const release = (/* RELEASE */ null) as unknown as Release;
const sw = globalThis as unknown as ServiceWorkerGlobalScope;
const cacheName = `neon-release-${release.version}`;
// Release paths are relative to the site root, where sw.js lives. The
// registration scope is narrower (`play/`, the game page), so the landing
// page at the root is never controlled by this worker.
const absolute = (path: string) => new URL(path, sw.location.href).href;
const marker = (lang: string) => absolute(`__offline_ready_${lang}`);

sw.addEventListener(
  "install",
  () => {/* Wait for explicit user approval on updates. */},
);
sw.addEventListener("activate", (event) => {
  // Retain old release caches: another open tab can still be running that code.
  event.waitUntil(sw.clients.claim());
});

/** Open game tabs. `includeUncontrolled` also lists same-origin landing tabs. */
async function gameClients() {
  const all = await sw.clients.matchAll({ includeUncontrolled: true });
  return all.filter((client) => client.url.startsWith(sw.registration.scope));
}

sw.addEventListener("message", (event) => {
  const port = event.ports[0];
  if (!port) return;
  const { type, lang = "en" } = event.data;
  if (type === "ACTIVATE") {
    event.waitUntil(
      (async () => {
        const clients = await gameClients();
        if (clients.length > 1) {
          port.postMessage({
            error:
              "Close other game tabs before applying an update, so their active runs are not interrupted.",
          });
          return;
        }
        await sw.skipWaiting();
        port.postMessage({ done: true });
      })(),
    );
    return;
  }
  if (
    !["STATUS", "DOWNLOAD", "CLEAN"].includes(type) ||
    !["en", "es", "zh"].includes(lang)
  ) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      if (type === "CLEAN") {
        // Only delete obsolete releases with this single client open.
        const clients = await gameClients();
        if (clients.length > 1) {
          throw new Error(
            "Close other game tabs before removing old downloads.",
          );
        }
        for (
          const key of await caches.keys()
        ) {
          if (
            key.startsWith("neon-release-") && key !== cacheName
          ) await caches.delete(key);
        }
        port.postMessage({ done: true });
        return;
      }
      const files = release.files.filter((f) => !f.lang || f.lang === lang);
      if (type === "STATUS") {
        // Check actual entries, not merely the completion marker (eviction can happen).
        const ready = !!await cache.match(marker(lang)) &&
          (await Promise.all(files.map((f) => cache.match(absolute(f.url)))))
            .every(Boolean);
        port.postMessage({
          done: true,
          ready,
          version: release.version,
          bytes: files.reduce((n, f) => n + f.bytes, 0),
        });
        return;
      }
      await cache.delete(marker(lang));
      let complete = 0;
      const total = files.reduce((n, f) => n + f.bytes, 0);
      for (const file of files) {
        const url = absolute(file.url);
        if (!await cache.match(url)) {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok || response.type === "opaque") {
            throw new Error(
              `Download failed: ${file.url} (${response.status})`,
            );
          }
          const data = await response.clone().arrayBuffer();
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
            (n) => n.toString(16).padStart(2, "0"),
          ).join("");
          // Also rejects a server's 200 HTML fallback for a missing audio/model file.
          if (hash !== file.hash) {
            throw new Error(
              `Release changed or invalid response: ${file.url}. Reconnect and check for updates.`,
            );
          }
          await cache.put(url, response);
        }
        complete += file.bytes;
        port.postMessage({ complete, total });
      }
      await cache.put(marker(lang), new Response("ready"));
      port.postMessage({ done: true, ready: true, version: release.version });
    })().catch((error) => port.postMessage({ error: String(error) })),
  );
});

sw.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    !["GET", "HEAD"].includes(request.method) ||
    new URL(request.url).origin !== sw.location.origin
  ) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const url = request.mode === "navigate"
      ? absolute("play/index.html")
      : request.url;
    const hit = await cache.match(url);
    if (hit) {
      return request.method === "HEAD"
        ? new Response(null, { status: hit.status, headers: hit.headers })
        : hit;
    }
    // Never turn failed audio requests into cached HTML, and never promise a cold offline shell.
    return fetch(request);
  })());
});
