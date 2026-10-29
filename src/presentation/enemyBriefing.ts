/** Six-second, safe-boundary-only introductions, derived from real wave order. */
import type { EnemyKind } from "../contracts/index.ts";
import { SECTORS } from "../sim/waves.ts";
import { ModelRegistry } from "../render/models.ts";
import {
  InspectionScene,
  type PresentationOptions,
} from "./inspectionScene.ts";

export const BRIEFING_SECONDS = 6;
export const ENEMY_INTEL = {
  drone: {
    en: ["Drone", "Weaves as it descends. Leave room to dodge."],
    es: ["Dron", "Zigzaguea al descender. Deja espacio para esquivar."],
    zh: ["无人机", "下降时左右摆动。留出闪避空间。"],
  },
  dart: {
    en: ["Dart", "Commits to a dive. Move out of its path."],
    es: ["Dardo", "Se lanza en picado. Apártate de su trayectoria."],
    zh: ["飞镖", "锁定方向后俯冲。避开它的路径。"],
  },
  turret: {
    en: ["Turret", "Fires a spread. Find the gap before advancing."],
    es: ["Torreta", "Dispara en abanico. Busca el hueco antes de avanzar."],
    zh: ["炮台", "发射扇形弹幕。找到空隙再前进。"],
  },
  lancer: {
    en: ["Lancer", "Enters from the sides. Watch both edges."],
    es: ["Lancero", "Entra por los lados. Vigila ambos bordes."],
    zh: ["长矛", "从两侧进入。留意左右边缘。"],
  },
} as const;

export interface BriefingRequest {
  sector: number;
  safeTransition: boolean;
  encountered: ReadonlySet<EnemyKind>;
  suppressed: boolean;
}

/** Prior-sector types are not called new, including checkpoint/skip-to starts. */
export function nextBriefing(request: BriefingRequest): EnemyKind | null {
  const { sector, safeTransition, encountered, suppressed } = request;
  if (!safeTransition || suppressed || !SECTORS[sector - 1]) return null;
  const prior = new Set(
    SECTORS.slice(0, sector - 1).flatMap((p) => p.waves.map((w) => w.kind)),
  );
  return [...SECTORS[sector - 1].waves].sort((a, b) => a.at - b.at)
    .find((wave) => !prior.has(wave.kind) && !encountered.has(wave.kind))
    ?.kind ?? null;
}

/** Mark seen on opening, so skipping cannot cause a repeated introduction. */
export class BriefingGate {
  readonly seen = new Set<EnemyKind>();
  suppressed = false;
  open(sector: number, safeTransition: boolean): EnemyKind | null {
    const kind = nextBriefing({
      sector,
      safeTransition,
      encountered: this.seen,
      suppressed: this.suppressed,
    });
    if (kind) this.seen.add(kind);
    return kind;
  }
}

export class EnemyBriefing extends InspectionScene {
  private hero;
  constructor(registry: ModelRegistry, readonly kind: EnemyKind) {
    super(registry);
    this.hero = this.model(kind, 6.5);
  }

  /** One movement demonstration, not a simulated attack or weapon claim. */
  update(elapsedS: number, options: PresentationOptions): boolean {
    this.fit();
    const p = Math.max(0, Math.min(1, elapsedS / BRIEFING_SECONDS));
    this.hero.rotation.y = options.reduceMotion ? 0.35 : 0.35 + p * 0.65;
    this.hero.position.set(0, 0, 0);
    if (!options.reduceMotion) {
      const demo = Math.max(0, Math.min(1, (elapsedS - 2.5) / 2));
      if (this.kind === "dart") {
        const dive = Math.max(0, Math.min(1, (elapsedS - 2.5) / 1.25));
        this.hero.position.set(-2 + dive * 4, 0, -4 + dive * 7);
      }
      if (this.kind === "drone") {
        this.hero.position.x = Math.sin(demo * Math.PI) * 1.4;
      }
      if (this.kind === "lancer") this.hero.position.x = -2 + demo * 4;
      if (this.kind === "turret") {
        const crown = this.hero.getObjectByName("crown");
        if (crown) crown.rotation.y = demo * 0.9;
      }
    }
    this.camera.position.set(9, 9, 12);
    this.camera.lookAt(0, 0, 0);
    return elapsedS >= BRIEFING_SECONDS;
  }
}
