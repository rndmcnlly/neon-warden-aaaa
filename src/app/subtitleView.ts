/**
 * The in-game subtitle layer: draws the Director's `SubtitleModel` with the
 * same `.nw-subtitle` markup and CSS variables as the settings preview, so
 * what the player tunes in Settings is exactly what plays.
 *
 * The model decides what is on screen (chunking, the two-line cap, which
 * layer wins); this view only paints it and follows the subtitle settings.
 */

import type { SettingsStore } from "../contracts/index.ts";
import type { SubtitleModel, SubtitleView } from "../director/subtitles.ts";
import { speakerName } from "../i18n/index.ts";

export interface SubtitleLayer {
  /** Follows a new model (each run gets a fresh Director). */
  attach(model: SubtitleModel): void;
  dispose(): void;
}

export function createSubtitleLayer(
  root: HTMLElement,
  settings: SettingsStore,
): SubtitleLayer {
  const box = document.createElement("div");
  box.className = "nw-subtitle nw-subtitle-live";
  box.setAttribute("role", "status");
  box.setAttribute("aria-live", "polite");
  const speaker = document.createElement("span");
  speaker.className = "nw-subtitle-speaker";
  const text = document.createElement("span");
  text.className = "nw-subtitle-text";
  box.append(speaker, text);
  root.appendChild(box);

  let view: SubtitleView | null = null;
  let detach: (() => void) | null = null;

  function paint(): void {
    const sub = settings.get().subtitles;
    box.style.setProperty("--subtitle-scale", String(sub.scale));
    box.style.setProperty("--subtitle-bg", String(sub.bgOpacity));
    box.style.setProperty("--subtitle-lines", String(sub.maxLines));
    box.hidden = !sub.enabled || view === null;
    if (!view) return;
    const name = speakerName(view.line, view.lang);
    speaker.textContent = name ?? "";
    speaker.hidden = !sub.speakerNames || !name;
    text.textContent = view.text;
    box.lang = view.lang === "zh" ? "zh-Hans" : view.lang;
    box.dataset.layer = view.layer;
  }

  const offSettings = settings.subscribe(paint);
  paint();

  return {
    attach(model) {
      detach?.();
      view = model.view;
      detach = model.subscribe((next) => {
        view = next;
        paint();
      });
      paint();
    },
    dispose() {
      detach?.();
      offSettings();
      box.remove();
    },
  };
}
