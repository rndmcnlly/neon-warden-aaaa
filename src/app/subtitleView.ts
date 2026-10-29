/**
 * The in-game subtitle layer: draws the Director's `SubtitleModel` with the
 * same `.nw-subtitle` markup and CSS variables as the settings preview, so
 * what the player tunes in Settings is exactly what plays.
 *
 * The model decides what is on screen (chunking, the two-line cap, which
 * layer wins); this view only paints it and follows the subtitle settings.
 *
 * Word pulse: when the take has word timings, each word is its own span and
 * the one being spoken gets `.is-spoken` (CSS scales it, or under reduced
 * motion changes weight and color only). Without timings the caption is
 * plain text, exactly as before.
 */

import type {
  Lang,
  LineId,
  SettingsStore,
  WordTiming,
} from "../contracts/index.ts";
import type { SubtitleModel, SubtitleView } from "../director/subtitles.ts";
import { speakerName, t } from "../i18n/index.ts";
import { activeWord, segmentChunk } from "../ui/wordPulse.ts";

export interface SubtitleLayer {
  /** Follows a new model (each run gets a fresh Director). */
  attach(model: SubtitleModel): void;
  dispose(): void;
}

export interface SubtitleLayerOptions {
  /** Word timings of a rendered take (from the VO manifest), if any. */
  wordsFor?(line: LineId, lang: Lang): readonly WordTiming[] | undefined;
  /** Milliseconds, on the same clock as `SubtitleView.startedAt`. */
  now?(): number;
}

/** Optional fields a richer `SubtitleView` may carry. */
type TimedView = SubtitleView & {
  readonly startedAt?: number;
  readonly words?: readonly WordTiming[];
};

export function createSubtitleLayer(
  root: HTMLElement,
  settings: SettingsStore,
  options: SubtitleLayerOptions = {},
): SubtitleLayer {
  const now = options.now ?? (() => performance.now());
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

  let view: TimedView | null = null;
  let detach: (() => void) | null = null;
  // Timing state for the current line: when it started, its words, spans.
  let lineKey = "";
  let lineStart = 0;
  let words: readonly WordTiming[] = [];
  let spans: (HTMLElement | null)[] = [];
  let lit = -1;
  let frame = 0;

  function paintText(v: TimedView): void {
    const key = `${v.line}|${v.lang}`;
    if (key !== lineKey) {
      lineKey = key;
      lineStart = v.startedAt ?? now();
      words = v.words ?? options.wordsFor?.(v.line, v.lang) ?? [];
    }
    const segments = segmentChunk(t(v.line, v.lang), v.text, words);
    spans = words.map(() => null);
    lit = -1;
    text.replaceChildren(
      ...segments.map((seg) => {
        if (seg.word < 0) return document.createTextNode(seg.text);
        const span = document.createElement("span");
        span.className = "nw-word";
        span.textContent = seg.text;
        spans[seg.word] = span;
        return span;
      }),
    );
    cancelAnimationFrame(frame);
    if (spans.some((s) => s !== null)) frame = requestAnimationFrame(tick);
  }

  function tick(): void {
    const index = activeWord(words, (now() - lineStart) / 1000);
    if (index !== lit) {
      spans[lit]?.classList.remove("is-spoken");
      spans[index]?.classList.add("is-spoken");
      lit = index;
    }
    frame = requestAnimationFrame(tick);
  }

  function paint(): void {
    const sub = settings.get().subtitles;
    box.style.setProperty("--subtitle-scale", String(sub.scale));
    box.style.setProperty("--subtitle-bg", String(sub.bgOpacity));
    box.style.setProperty("--subtitle-lines", String(sub.maxLines));
    box.hidden = !sub.enabled || view === null;
    if (!view) {
      cancelAnimationFrame(frame);
      lineKey = "";
      delete box.dataset.text;
      return;
    }
    const name = speakerName(view.line, view.lang);
    speaker.textContent = name ?? "";
    speaker.hidden = !sub.speakerNames || !name;
    box.lang = view.lang === "zh" ? "zh-Hans" : view.lang;
    box.dataset.layer = view.layer;
    if (box.dataset.text !== view.text) {
      box.dataset.text = view.text;
      paintText(view);
    }
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
      cancelAnimationFrame(frame);
      box.remove();
    },
  };
}
