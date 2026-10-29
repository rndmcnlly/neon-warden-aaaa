/**
 * Dev panel for A/B variants (`?dev=1`): one native select per axis of the
 * registry. Changing one switches the take live (music crossfades, voice
 * applies from the next line) and rewrites the `v.` parameters in the
 * address bar, so a reload or a shared link reproduces the choice. Its
 * text is developer-facing, the one allowed exception to the LineId rule
 * (as in `src/ui/devOverlay.ts`). Native selects work with mouse, touch and
 * keyboard alike.
 */

import { VARIANT_PREFIX } from "../contracts/index.ts";
import type { VariantRegistry } from "./variants.ts";

export function mountVariantPanel(
  root: HTMLElement,
  registry: VariantRegistry,
): void {
  const axes = registry.axes();
  if (!axes.length) return;
  const panel = document.createElement("details");
  panel.className = "nw-variant-panel";
  panel.style.cssText =
    "position:fixed;right:8px;bottom:8px;z-index:9999;max-width:min(92vw,320px);" +
    "background:rgba(6,10,20,.88);color:#cfe;font:12px/1.4 ui-monospace,monospace;" +
    "padding:6px 10px;border:1px solid #2a5;border-radius:6px";
  const summary = document.createElement("summary");
  summary.textContent = "A/B variants";
  panel.append(summary);
  for (const axis of axes) {
    const label = document.createElement("label");
    label.style.cssText =
      "display:flex;gap:8px;justify-content:space-between;" +
      "align-items:center;margin:4px 0";
    label.textContent = axis.id;
    const select = document.createElement("select");
    select.dataset.axis = axis.id;
    for (const c of axis.choices) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c === axis.defaultChoice ? `${c} (default)` : c;
      select.append(opt);
    }
    select.value = registry.get(axis.id) ?? axis.defaultChoice;
    if (axis.note) select.title = axis.note;
    select.addEventListener("change", () => {
      registry.set(axis.id, select.value);
      const url = new URL(location.href);
      for (const k of [...url.searchParams.keys()]) {
        if (k.startsWith(VARIANT_PREFIX)) url.searchParams.delete(k);
      }
      for (const q of registry.toQuery()) {
        const [k, v] = q.split("=");
        url.searchParams.set(k, v);
      }
      history.replaceState(history.state, "", url);
    });
    // Keys typed here must not steer the ship or the menus.
    select.addEventListener("keydown", (e) => e.stopPropagation());
    label.append(select);
    panel.append(label);
  }
  for (const w of registry.warnings) {
    const p = document.createElement("p");
    p.style.color = "#fc6";
    p.textContent = w;
    panel.append(p);
  }
  root.append(panel);
}
