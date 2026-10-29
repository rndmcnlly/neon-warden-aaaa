/**
 * Ship customization, as the renderer sees it: which package meshes are
 * mounted in the ship's sockets, and the cosmetic material parameters.
 *
 * The model side (art/blender/pilot_ship.py) ships every variant in one
 * glTF: `socket_weapon` holds `weapon_<id>` meshes, `socket_sensor` holds
 * `sensor_<id>`, `ship_decals` holds `decal_<id>` (ids lowercased, since
 * node names are `[a-z0-9_]`). Applying a loadout only toggles visibility
 * and recolors the ship's own cloned materials, so a hangar change is
 * instant and costs no loading. Out-of-slice packages have meshes too: the
 * hangar can show them, walled, with the real model.
 */

import * as THREE from "three";
import type {
  Cosmetics,
  HelmetLiveryId,
  Loadout,
  PaintId,
  TrailId,
} from "../contracts/index.ts";
import { PALETTE } from "./palette.ts";
import { ownMaterials } from "./vfx.ts";

/** Hull paint base colors (linear-ish albedo, not emissive). */
export const PAINT: Readonly<Record<PaintId, number>> = {
  authorityWhite: 0xd8dde4,
  contractorGrey: 0x5a606a,
  matteBlack: 0x15171c,
  rustRed: 0x7a2e22,
  laneBlue: 0x1f4c7a,
};

/** Engine plume and trail colors. */
export const TRAIL: Readonly<Record<TrailId, number>> = {
  standard: PALETTE.cyan,
  ion: 0x8fa8ff,
  ember: PALETTE.amber,
  ghost: 0xd8e6ee,
};

export type HelmetVariant = "issued" | "worn";

/** Corporate issue early, worn (or repainted over the wear) by the end. */
export function helmetFor(livery: HelmetLiveryId): HelmetVariant {
  return livery === "corporateIssue" ? "issued" : "worn";
}

/** Shows exactly one `<prefix>_<id>` child under `socket` (others hidden). */
function mount(
  root: THREE.Object3D,
  socket: string,
  prefix: string,
  id: string,
): void {
  const s = root.getObjectByName(socket);
  if (!s) return;
  const want = `${prefix}_${id.toLowerCase()}`;
  // Only toggle if the requested variant exists, so a bad id keeps the default.
  if (!s.children.some((c) => c.name === want)) return;
  for (const c of s.children) {
    if (c.name.startsWith(`${prefix}_`)) c.visible = c.name === want;
  }
}

/** Applies a loadout to a ship instance; returns its trail color. */
export function applyShipLoadout(
  ship: THREE.Object3D,
  loadout: Loadout,
): THREE.Color {
  mount(ship, "socket_weapon", "weapon", loadout.weapon);
  mount(ship, "socket_sensor", "sensor", loadout.sensor);
  const c: Cosmetics = loadout.cosmetics;
  mount(ship, "ship_decals", "decal", c.decal);
  const trail = new THREE.Color(TRAIL[c.trail]);
  for (const o of ownMaterials(ship)) {
    const name = o.mat.name;
    if (/paint/.test(name)) {
      o.color.set(PAINT[c.paint]);
      o.mat.color.copy(o.color);
    } else if (/trim/.test(name)) {
      o.emissive.set(c.trimColor);
      o.mat.emissive.copy(o.emissive);
    } else if (/engine|exhaust/.test(name)) {
      o.emissive.copy(trail);
      o.mat.emissive.copy(o.emissive);
    }
  }
  return trail;
}
