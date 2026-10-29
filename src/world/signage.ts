/**
 * Physical signage on the set pieces: painted, stenciled, brushed, carved or
 * lit text, localized in EN/ES/ZH (vocabulary from docs/narrative/BIBLE.md).
 *
 * Blender places a `sign__<id>` (tilted toward the camera) or `paint__<id>`
 * (flat on a deck) empty whose scale is the panel size in meters; this table
 * owns only words and lettering style. These are short place names and jokes
 * that belong to the scenery; the longer lull-gated discoveries in `lore.ts`
 * remain the reading surface and the archive.
 */
import type { WorldLanguage } from "./lore.ts";

export type SignStyle = "lit" | "stencil" | "painted" | "brush" | "carved";

export interface SignSpec {
  readonly style: SignStyle;
  /** Lines per language, one array entry per painted line. */
  readonly text: Readonly<Record<WorldLanguage, readonly string[]>>;
  /** Ink and ground colors (CSS); ground "" leaves the backing plate visible. */
  readonly ink: string;
  readonly ground: string;
}

const sign = (
  style: SignStyle,
  ink: string,
  ground: string,
  en: string[],
  es: string[],
  zh: string[],
): SignSpec => ({ style, ink, ground, text: { en, es, zh } });

export const SIGNS: Readonly<Record<string, SignSpec>> = {
  od_beacon: sign(
    "lit",
    "#f2d9a8",
    "#151a20",
    ["PUBLIC BEACON 7", "QUEUE HERE · NO FEE"],
    ["BALIZA PÚBLICA 7", "HAGA FILA · SIN COBRO"],
    ["公共航标 7", "在此排队 · 免费"],
  ),
  od_deck: sign(
    "painted",
    "#c2a35a",
    "",
    ["FREE PASSAGE"],
    ["PASO LIBRE"],
    ["自由通行"],
  ),
  od_waystation: sign(
    "painted",
    "#d8c9a0",
    "",
    ["WAYSTATION · WATER · REST"],
    ["ESTACIÓN · AGUA · DESCANSO"],
    ["驿站 · 饮水 · 休息"],
  ),
  sb_commons: sign(
    "brush",
    "#efe4c8",
    "#5e4c33",
    ["COMMONS REPAIR CREW 08", "BRIDGE OPEN SOON (ISH)"],
    ["CUADRILLA COMUNAL 08", "PUENTE ABIERTO PRONTO (MÁS O MENOS)"],
    ["公地维修队 08", "桥快修好了（大概）"],
  ),
  gl_ticker: sign(
    "lit",
    "#ffd38a",
    "#0d1016",
    [
      "TOLL DUE 0.00 · BILLED 4,812.00 · INSPECTION CAPACITY 0 · THANK YOU FOR YOUR COMPLIANCE · ",
    ],
    [
      "PEAJE ADEUDADO 0,00 · FACTURADO 4.812,00 · CAPACIDAD DE INSPECCIÓN 0 · GRACIAS POR SU CUMPLIMIENTO · ",
    ],
    ["应缴通行费 0.00 · 已开票 4,812.00 · 检查能力 0 · 感谢您的配合 · "],
  ),
  gl_customs: sign(
    "stencil",
    "#b9ab7a",
    "",
    ["LANE AUTHORITY CUSTOMS 3"],
    ["ADUANA 3 · AUTORIDAD DE RUTAS"],
    ["航道管理局 · 第3海关"],
  ),
  gl_pod: sign(
    "stencil",
    "#d8d4c8",
    "",
    ["WATER · NOT FOR SALE"],
    ["AGUA · NO SE VENDE"],
    ["饮用水 · 非卖品"],
  ),
  gl_tower: sign(
    "painted",
    "#b9ab7a",
    "",
    ["LANE AUTHORITY", "BILLING DEPARTMENT"],
    ["AUTORIDAD DE RUTAS", "DEPARTAMENTO DE FACTURACIÓN"],
    ["航道管理局", "计费部"],
  ),
  lg_yard: sign(
    "painted",
    "#f0dcc0",
    "#6e3f22",
    ["SALTLINE HAULERS", "TRANSFER YARD"],
    ["TRANSPORTISTAS DE LA LÍNEA DE SAL", "PATIO DE TRASBORDO"],
    ["盐线货运行会", "转运场"],
  ),
  lg_saltline: sign(
    "stencil",
    "#efe4cc",
    "",
    ["SALTLINE"],
    ["LÍNEA DE SAL"],
    ["盐线"],
  ),
  lg_bay: sign(
    "stencil",
    "#d0b060",
    "",
    ["BAY 4 · KEEP CLEAR"],
    ["BAHÍA 4 · NO OBSTRUIR"],
    ["4号泊位 · 保持畅通"],
  ),
  la_nursery: sign(
    "carved",
    "#e6d6b4",
    "#2a2430",
    ["QUIET PLEASE", "SCOUTS GROWING"],
    ["SILENCIO, POR FAVOR", "EXPLORADORES CRECIENDO"],
    ["请保持安静", "侦察机生长中"],
  ),
  la_heartgate: sign(
    "carved",
    "#e6d6b4",
    "",
    ["OPEN TO ALL WHO COME UNARMED"],
    ["ABIERTO A QUIEN LLEGUE DESARMADO"],
    ["向所有不带武器者开放"],
  ),
};

const FONTS: Record<SignStyle, string> = {
  lit: "600 {px}px ui-monospace, Menlo, monospace",
  stencil: "800 {px}px Impact, 'Arial Narrow', sans-serif",
  painted: "700 {px}px 'Helvetica Neue', Arial, sans-serif",
  brush: "700 italic {px}px 'Marker Felt', 'Comic Sans MS', cursive",
  carved: "500 {px}px Georgia, 'Times New Roman', serif",
};

/** Pixel density per meter of panel; small panels still get legible glyphs. */
const PX_PER_M = 24;

/** Canvas size for a panel, power-of-two friendly and capped for memory. */
export function canvasSize(w: number, h: number): [number, number] {
  const fit = (m: number) =>
    Math.min(512, Math.max(64, 2 ** Math.round(Math.log2(m * PX_PER_M))));
  return [fit(w), fit(h)];
}

/**
 * Paint a sign. Tall panels (painted along a container or bay roof) run the
 * text along their long axis. `scroll` (0–1) offsets a single-line ticker.
 */
export function paintSign(
  ctx: CanvasRenderingContext2D,
  spec: SignSpec,
  language: WorldLanguage,
  scroll = -1,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (spec.ground) {
    ctx.fillStyle = spec.ground;
    ctx.fillRect(0, 0, width, height);
  }
  const tall = height > width * 1.4;
  let w = width, h = height;
  if (tall) {
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-height / 2, -width / 2);
    [w, h] = [height, width];
  }
  const lines = spec.text[language];
  ctx.fillStyle = spec.ink;
  ctx.textBaseline = "middle";
  if (scroll >= 0) {
    // One-line ticker: repeat the message and slide it left.
    const px = Math.floor(h * 0.62);
    ctx.font = FONTS[spec.style].replace("{px}", String(px));
    const line = lines[0];
    const span = ctx.measureText(line).width;
    let x = -scroll * span;
    while (x < w) {
      ctx.fillText(line, x, h / 2);
      x += span;
    }
    ctx.restore();
    return;
  }
  ctx.textAlign = "center";
  const rowH = h / lines.length;
  for (const [i, line] of lines.entries()) {
    let px = Math.floor(rowH * (i === 0 ? 0.72 : 0.6));
    ctx.font = FONTS[spec.style].replace("{px}", String(px));
    // Shrink to fit width rather than wrap: these are names, not paragraphs.
    const measured = ctx.measureText(line).width;
    if (measured > w * 0.92) {
      px = Math.floor(px * (w * 0.92) / measured);
      ctx.font = FONTS[spec.style].replace("{px}", String(px));
    }
    const y = rowH * (i + 0.5);
    if (spec.style === "brush") {
      ctx.save();
      ctx.translate(w / 2, y);
      ctx.rotate(i % 2 ? 0.02 : -0.025);
      ctx.fillText(line, 0, 0);
      ctx.restore();
    } else if (spec.style === "stencil") {
      ctx.fillText(line, w / 2, y);
      // Stencil bridges: thin gaps cut through the letters.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(0, y - px * 0.04, w, px * 0.08);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.fillText(line, w / 2, y);
    }
  }
  if (spec.style === "painted" || spec.style === "stencil") {
    // Weathering: deterministic scuffs so paint reads as paint, not UI.
    ctx.globalCompositeOperation = "destination-out";
    let seed = lines.join("").length * 9301;
    for (let i = 0; i < 40; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const x = (seed / 233280) * w;
      seed = (seed * 9301 + 49297) % 233280;
      const y = (seed / 233280) * h;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x, y, w * 0.03, h * 0.012 + 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}
