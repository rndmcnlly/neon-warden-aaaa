/**
 * Landing page behavior: the language switch, and nothing else. The page is
 * complete in English without this script (Play, the teaser and every link
 * work as plain HTML); this module only swaps in Spanish or Chinese text.
 * No game code, three.js or service worker is loaded here.
 */
import { type Key, type Lang, LANGS, pickLang, STRINGS } from "./strings.ts";
import "./landing.css";

/** sessionStorage, not localStorage: shared school devices reset per tab. */
const STORE = "neon-warden.landing.lang";
const HTML_LANG: Record<Lang, string> = { en: "en", es: "es", zh: "zh-Hans" };

function apply(lang: Lang) {
  document.documentElement.lang = HTML_LANG[lang];
  document.title = STRINGS.title[lang];
  for (const el of document.querySelectorAll<HTMLElement>("[data-t]")) {
    const key = el.dataset.t as Key;
    if (key in STRINGS) el.textContent = STRINGS[key][lang];
  }
  const note = document.querySelector<HTMLElement>(".en-only");
  if (note) note.hidden = lang === "en";
  for (const b of document.querySelectorAll<HTMLElement>("[data-lang]")) {
    b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  }
}

let stored: string | null = null;
try {
  stored = sessionStorage.getItem(STORE);
} catch { /* storage can be disabled by policy; English still works */ }
const initial = pickLang(location.search, stored, navigator.languages ?? []);
if (initial !== "en") apply(initial);

for (const button of document.querySelectorAll<HTMLElement>("[data-lang]")) {
  button.addEventListener("click", () => {
    const lang = button.dataset.lang as Lang;
    if (!LANGS.includes(lang)) return;
    apply(lang);
    try {
      sessionStorage.setItem(STORE, lang);
    } catch { /* see above */ }
  });
}
