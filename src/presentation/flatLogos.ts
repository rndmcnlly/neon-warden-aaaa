/** Passive, screen-space branding. The Director owns time, music and skipping. */
export type LogoBrand = "studio" | "incubator";

export interface LogoSettings {
  reducedMotion?: boolean;
  reducedFlashing?: boolean;
}

/** Pure timing function: safe to seek, pause or skip without pending callbacks. */
export function logoFrame(elapsedMs: number, settings: LogoSettings = {}) {
  const t = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const still = settings.reducedMotion || settings.reducedFlashing;
  return {
    opacity: still ? 1 : Math.min(1, t / 480),
    // A single low-contrast sweep, never a repeating flash.
    glint: still || t < 600 || t > 1700
      ? 0
      : Math.sin((t - 600) / 1100 * Math.PI) * 0.12,
    glintX: Math.min(85, Math.max(0, (t - 600) / 1100 * 85)),
  };
}

export interface FlatLogoLayer {
  /** Idempotent for the current brand. Taglines are localized by the caller. */
  show(brand: LogoBrand, tagline?: string): void;
  /** Elapsed milliseconds since this brand's timeline cue. No internal clock. */
  update(elapsedMs: number): void;
  setSettings(settings: LogoSettings): void;
  hide(): void;
  dispose(): void;
}

/** Import flatLogos.css once at the integration boundary. No global listeners. */
export function createFlatLogos(
  host: HTMLElement,
  initialSettings: LogoSettings = {},
  assetBase = "/branding/",
): FlatLogoLayer {
  const root = document.createElement("div");
  root.className = "nw-flat-logos";
  root.hidden = true;
  const lockup = document.createElement("div");
  lockup.className = "nw-flat-lockup";
  const mark = document.createElement("img");
  mark.className = "nw-flat-mark";
  mark.alt = "";
  mark.setAttribute("aria-hidden", "true");
  mark.draggable = false;
  const name = document.createElement("div");
  name.className = "nw-flat-name";
  const cohort = document.createElement("div");
  cohort.className = "nw-flat-cohort";
  cohort.textContent = "f26";
  const tag = document.createElement("div");
  tag.className = "nw-flat-tag";
  const glint = document.createElement("div");
  glint.className = "nw-flat-glint";
  glint.setAttribute("aria-hidden", "true");
  lockup.append(mark, name, cohort, tag);
  root.append(lockup, glint);
  host.append(root);
  let settings = { ...initialSettings };
  let elapsed = 0;
  let disposed = false;
  const update = (ms: number) => {
    if (disposed) return;
    elapsed = ms;
    const frame = logoFrame(ms, settings);
    lockup.style.opacity = String(frame.opacity);
    glint.style.opacity = String(frame.glint);
    glint.style.left = `${frame.glintX}%`;
  };
  return {
    show(brand, tagline = "") {
      if (disposed) return;
      const changed = root.dataset.brand !== brand || root.hidden;
      root.dataset.brand = brand;
      name.textContent = brand === "studio" ? "adamsmith.systems" : "CM121";
      const asset = brand === "studio"
        ? "studio-mark.svg"
        : "incubator-mark.svg";
      if (changed) mark.src = `${assetBase.replace(/\/?$/, "/")}${asset}`;
      cohort.hidden = brand !== "incubator";
      tag.textContent = tagline;
      tag.hidden = !tagline;
      root.hidden = false;
      // A caller that only uses show/hide gets a complete static fallback.
      if (changed) update(2000);
    },
    update,
    setSettings(next) {
      settings = { ...next };
      update(elapsed);
    },
    hide() {
      root.hidden = true;
    },
    dispose() {
      disposed = true;
      root.remove();
    },
  };
}
