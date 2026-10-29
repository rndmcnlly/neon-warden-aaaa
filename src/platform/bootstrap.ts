import { createSettingsStore } from "../settings/store.ts";
import { installFullscreenShortcut, setFullscreen } from "./fullscreen.ts";
import "./platform.css";

const settings = createSettingsStore();
installFullscreenShortcut();
const panel = document.createElement("details");
panel.id = "platform-tools";
panel.innerHTML = `<summary>Install / offline / screen</summary>
<button type="button" id="platform-fullscreen">Fullscreen (F)</button>
<button type="button" id="platform-install">Install game</button>
<label>Offline voice pack <select id="platform-lang"><option value="en">English</option><option value="es">Español</option><option value="zh">中文</option></select></label>
<button type="button" id="platform-download">Download playable slice + voice pack</button>
<progress id="platform-progress" max="1" value="0" aria-label="Offline download progress"></progress>
<p id="platform-status" role="status" aria-live="polite">Installation and offline download are separate.</p>
<button type="button" id="platform-update" hidden>Apply update and reload (ends current run)</button>
<button type="button" id="platform-clean">Remove obsolete downloads (close other game tabs first)</button>
<button type="button" id="platform-close">Back / close</button>`;
document.body.append(panel);
const find = <T extends HTMLElement>(id: string) =>
  panel.querySelector<T>(`#platform-${id}`)!;
const status = find<HTMLParagraphElement>("status");
const say = (text: string) => {
  status.textContent = text;
};
const lang = find<HTMLSelectElement>("lang");
lang.value = settings.get().voiceLang;
settings.subscribe((s) => {
  lang.value = s.voiceLang;
  find<HTMLButtonElement>("fullscreen").setAttribute(
    "aria-pressed",
    String(s.display.fullscreen),
  );
});
find("close").onclick = () => {
  panel.open = false;
};
find("fullscreen").onclick = () => {
  void setFullscreen(!document.fullscreenElement);
};
globalThis.addEventListener("platform-notice", (event) => {
  panel.open = true;
  say((event as CustomEvent<string>).detail);
});

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let installPrompt: InstallEvent | null = null;
globalThis.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as InstallEvent;
});
find("install").onclick = async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    say(
      `Installation ${choice.outcome}. Offline resources must still be downloaded separately.`,
    );
    installPrompt = null;
  } else {say(
      "Use your browser's Install app menu. On iPhone/iPad: Safari → Share → Add to Home Screen. Installation does not download offline resources.",
    );}
};

type Reply = {
  done?: boolean;
  ready?: boolean;
  bytes?: number;
  complete?: number;
  total?: number;
  error?: string;
};
function message(
  worker: ServiceWorker,
  type: string,
  language = lang.value,
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        channel.port1.close();
        reject(new Error("Worker did not respond. Reconnect and retry."));
      }, 120_000);
    };
    timeout();
    channel.port1.onmessage = ({ data }: MessageEvent<Reply>) => {
      timeout();
      if (data.total) {
        find<HTMLProgressElement>("progress").value = (data.complete ?? 0) /
          data.total;
        say(
          `Downloading ${
            Math.round((data.complete ?? 0) / data.total * 100)
          }% (${Math.round(data.total / 1048576)} MiB). Keep this tab open.`,
        );
      }
      if (data.done || data.error) {
        clearTimeout(timer);
        channel.port1.close();
        if (data.error) reject(new Error(data.error));
        else resolve(data);
      }
    };
    worker.postMessage({ type, lang: language }, [channel.port2]);
  });
}

// Vite replaces this literal at build time. Development never registers a worker.
const production =
  (import.meta as ImportMeta & { env: { PROD: boolean; BASE_URL: string } })
    .env;
if (
  production.PROD && "serviceWorker" in navigator && globalThis.isSecureContext
) {
  void setup().catch((error) => say(`Offline unavailable: ${String(error)}`));
} else {
  say(
    "Offline downloads require the production build on HTTPS (or localhost preview). Development is never cached.",
  );
  find<HTMLButtonElement>("download").disabled = true;
}

async function setup() {
  const registration = await navigator.serviceWorker.register(
    `${production.BASE_URL}sw.js`,
    { scope: production.BASE_URL, updateViaCache: "none" },
  );
  await navigator.serviceWorker.ready;
  const active = () => registration.active!;
  const check = async () => {
    const result = await message(active(), "STATUS");
    find<HTMLProgressElement>("progress").value = result.ready ? 1 : 0;
    say(
      result.ready
        ? `Offline ready: playable slice + ${
          lang.selectedOptions[0].text
        } voice pack. Browser storage can still be evicted.`
        : `Not offline ready for ${
          lang.selectedOptions[0].text
        }. Download required (${
          Math.round((result.bytes ?? 0) / 1048576)
        } MiB). Installation is separate.`,
    );
  };
  const update = find<HTMLButtonElement>("update");
  const pending = () => {
    update.hidden = !registration.waiting;
  };
  pending();
  registration.addEventListener("updatefound", () => {
    registration.installing?.addEventListener("statechange", pending);
  });
  update.onclick = async () => {
    if (!navigator.onLine) {
      say(
        "Reconnect before applying an update. Your current downloaded release remains available offline.",
      );
      return;
    }
    if (
      !registration.waiting ||
      !confirm(
        "End this run and reload the new version? Its offline pack must be downloaded again.",
      )
    ) return;
    const changed = new Promise<void>((resolve) =>
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => resolve(),
        { once: true },
      )
    );
    try {
      await message(registration.waiting, "ACTIVATE");
      await changed;
      location.reload();
    } catch (error) {
      say(String(error));
    }
  };
  lang.onchange = () => {
    void check().catch((e) => say(String(e)));
  };
  settings.subscribe(() => {
    void check().catch((e) => say(String(e)));
  });
  find("download").onclick = async () => {
    const button = find<HTMLButtonElement>("download");
    button.disabled = true;
    try {
      const info = await message(active(), "STATUS");
      const estimate = await navigator.storage?.estimate();
      if (
        estimate?.quota &&
        estimate.quota - (estimate.usage ?? 0) < (info.bytes ?? 0)
      ) {
        say(
          "Storage may be insufficient. Free space if downloading fails; existing downloaded files will be reused.",
        );
      }
      await navigator.storage?.persist?.();
      await message(active(), "DOWNLOAD");
      await check();
    } catch (error) {
      say(
        `Not offline ready. ${
          String(error)
        }. Free storage or reconnect, then retry. Partial downloads are reused.`,
      );
    } finally {
      button.disabled = false;
    }
  };
  find("clean").onclick = async () => {
    try {
      await message(active(), "CLEAN");
      say("Obsolete downloads removed. Current release retained.");
    } catch (error) {
      say(String(error));
    }
  };
  await check();
}
