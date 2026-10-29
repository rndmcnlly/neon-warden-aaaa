/** Five shots keyed to the EXISTING recording, never a parallel VO timeline. */
import * as THREE from "three";
import { ModelRegistry } from "../render/models.ts";
import {
  InspectionScene,
  type PresentationOptions,
} from "./inspectionScene.ts";

export type MemoryLine =
  | "flash_rec_001"
  | "flash_rec_002"
  | "flash_rec_003"
  | "flash_rec_004"
  | "flash_rec_005"
  | "flash_rec_006";
export type MemoryShot = "approach" | "stop" | "traffic" | "recall" | "cut";
export const MEMORY_SHOTS: Record<MemoryLine, MemoryShot> = {
  flash_rec_001: "approach",
  flash_rec_002: "stop",
  flash_rec_003: "stop",
  flash_rec_004: "traffic",
  flash_rec_005: "recall",
  flash_rec_006: "cut",
};
export const MEMORY_READOUT = {
  en: {
    approach: "0121 · LAST APPROACH · WEAPON COLD",
    stop: "0121 · VELOCITY 0 · WEAPON COLD",
    traffic: "LANE TRAFFIC · NO WEAPONS",
    recall: "0121 · RECALL INITIATED",
    cut: "0121 · SIGNAL LOST",
  },
  es: {
    approach: "0121 · APROXIMACIÓN FINAL · ARMA FRÍA",
    stop: "0121 · VELOCIDAD 0 · ARMA FRÍA",
    traffic: "TRÁFICO DE RUTA · SIN ARMAS",
    recall: "0121 · RETIRO INICIADO",
    cut: "0121 · SEÑAL PERDIDA",
  },
  zh: {
    approach: "0121 · 最终进近 · 武器未开火",
    stop: "0121 · 速度0 · 武器未开火",
    traffic: "航道交通 · 无武器",
    recall: "0121 · 召回已启动",
    cut: "0121 · 信号丢失",
  },
} as const;

export class MemoryScene extends InspectionScene {
  private ship: THREE.Group;
  private warden: THREE.Group;
  private traffic: THREE.Group[];
  private recall: THREE.Mesh;
  shot: MemoryShot = "approach";
  /** Comms identity, not an invented spoken line. */
  speaker: "recorder" | "warden" = "recorder";

  constructor(registry: ModelRegistry) {
    super(registry);
    this.ship = this.model("pilot_ship", 4.7);
    this.warden = this.model("warden", 8.7);
    this.warden.position.set(4.5, 0, -6);
    // Unarmed civilian hulls use the ship glTF, with weapon sockets hidden.
    // A visual reuse, not a claim that the armed enemy dart is civilian traffic.
    this.traffic = [-1, 1, 3].map((x) => {
      const hull = this.model("pilot_ship", 2.2);
      hull.position.set(x, 0, -1);
      return hull;
    });
    const deck = this.box([25, 0.3, 32], 0x152939);
    deck.position.y = -2;
    for (const x of [-8, -2, 9]) {
      this.box([0.09, 0.04, 30], 0x426578).position.set(x, -1.82, 0);
    }
    this.recall = this.box([0.16, 8, 0.16], 0xf1a95c);
  }

  /** elapsedS/durationS are the Director's unchanged take clock, in seconds. */
  update(
    line: MemoryLine,
    elapsedS: number,
    durationS: number,
    options: PresentationOptions,
  ): void {
    this.fit();
    this.shot = MEMORY_SHOTS[line];
    this.speaker =
      ["flash_rec_003", "flash_rec_004", "flash_rec_006"].includes(line)
        ? "warden"
        : "recorder";
    const p = THREE.MathUtils.clamp(elapsedS / Math.max(durationS, 0.01), 0, 1);
    const quiet = options.reduceMotion;
    // A visible arrival, deceleration, and sustained stop. The prior pass's
    // seven-second drift was too subtle for the blind observer to reconstruct.
    const approach = Math.min(1, elapsedS / 3);
    this.ship.position.set(
      -5,
      0,
      this.shot === "approach" ? 14 - 10 * (1 - (1 - approach) ** 2) : 4,
    );
    if (quiet) this.ship.position.z = 4;
    this.ship.rotation.y = -0.12;
    for (const hull of [this.ship, ...this.traffic]) {
      hull.traverse((o) => {
        if (o.name.startsWith("weapon_")) {
          o.visible = o.name === "weapon_standard";
        }
        if (o.name.startsWith("sensor_")) {
          o.visible = o.name === "sensor_standard";
        }
        if (o.name.startsWith("decal_")) {
          o.visible = o.name === "decal_authoritynumber";
        }
      });
    }
    this.warden.rotation.y = -0.15;
    this.recall.visible = this.shot === "recall" || this.shot === "cut";
    this.recall.position.set(-5, 3, 4);
    this.recall.scale.y = this.shot === "recall" ? 0.2 + 0.8 * p : 1;
    // No flash, teleport, death or depicted body. The hull remains at its stop.
    const engine = this.ship.getObjectByName("engine");
    if (engine) engine.visible = this.shot !== "cut";
    for (let i = 0; i < this.traffic.length; i++) {
      const hull = this.traffic[i];
      hull.visible = ["traffic", "recall", "cut"].includes(this.shot);
      hull.position.z = quiet ? -1 + i * 2 : -9 + p * 16 + i * 2;
      hull.rotation.y = Math.PI;
      hull.traverse((o) => {
        if (o.name === "socket_weapon" || o.name.startsWith("weapon_")) {
          o.visible = false;
        }
      });
    }
    const portrait = this.camera.aspect < 0.8;
    const cameras: Record<MemoryShot, number[]> = {
      approach: [-1, 12, 24, -4, 0, 6],
      stop: [3, 13, 19, -1, 0, 0],
      traffic: [12, 11, 13, 2, 0, -2],
      recall: [-1, 8, 13, -5, 1, 4],
      cut: [-1, 8, 13, -5, 1, 4],
    };
    const c = cameras[this.shot];
    const target = new THREE.Vector3(c[3], c[4], c[5]);
    this.camera.position.set(c[0], c[1], c[2]);
    if (portrait) {
      this.camera.position.sub(target).multiplyScalar(1.35).add(target);
    }
    this.camera.lookAt(target);
    // Deliberately no noise/strobe path, even when reduced flashing is off.
  }
}
