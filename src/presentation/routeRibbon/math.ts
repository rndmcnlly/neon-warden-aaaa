/** Renderer-independent route ribbon. Units: world units, sim pixels, radians.
 * +forward follows the authored route; sim +y points BACK along that route.
 * This is presentation only: never feed its output into collision or controls.
 */
import { PLAYFIELD } from "../../contracts/index.ts";

export type V3 = readonly [number, number, number];
export const add = (
  a: V3,
  b: V3,
): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (
  a: V3,
  b: V3,
): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: V3): number => Math.hypot(...a);
export function unit(a: V3): V3 {
  const n = length(a);
  if (n < 1e-10) throw new Error("Degenerate route tangent/frame");
  return mul(a, 1 / n);
}
const mix = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(v, b));
const smooth = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));

export interface Segment {
  readonly name: string;
  readonly from: V3;
  readonly to: V3;
}
export const SEGMENTS: readonly Segment[] = [
  { name: "Industrial sweep", from: [0, 0, 0], to: [6, 0, -80] },
  { name: "Rising gate", from: [6, 0, -80], to: [8, 10, -160] },
  { name: "Boss arena", from: [8, 10, -160], to: [8, 10, -240] },
];

/** Quintic spline in transverse axes; linear forward axis. C2 at joins for
 * these equal-length authored segments. No banking in the combat frame.
 */
export function authoredPoint(segment: Segment, t: number): V3 {
  const q = smooth(t);
  return [
    segment.from[0] + (segment.to[0] - segment.from[0]) * q,
    segment.from[1] + (segment.to[1] - segment.from[1]) * q,
    segment.from[2] + (segment.to[2] - segment.from[2]) * t,
  ];
}

export interface Frame {
  readonly s: number;
  readonly center: V3;
  readonly forward: V3;
  readonly right: V3;
  readonly up: V3;
}
export interface Route {
  readonly frames: readonly Frame[];
  readonly length: number;
  readonly joins: readonly number[];
}

/** Minimal-rotation parallel transport, not Frenet frames (which flip at
 * inflections). Exact reversals are not valid route geometry: reject them.
 */
export function transport(right: V3, before: V3, after: V3): V3 {
  const c = dot(before, after);
  if (c < -0.9999) throw new Error("Route cusp: subdivide or reauthor");
  const axis = cross(before, after);
  const rotated = add(
    add(right, cross(axis, right)),
    mul(cross(axis, cross(axis, right)), 1 / (1 + c)),
  );
  return unit(sub(rotated, mul(after, dot(rotated, after))));
}

/** Build once, not per bullet. 0.25 nominal world-unit spacing by default.
 * Arc lengths use polyline chords; sampling is deterministic and bounded.
 */
export function buildRoute(segments = SEGMENTS, steps = 320): Route {
  if (steps < 8 || !Number.isInteger(steps)) {
    throw new Error("Need >=8 integral steps");
  }
  const points: V3[] = [];
  const joinIndices: number[] = [];
  segments.forEach((segment, j) => {
    if (j && length(sub(segment.from, segments[j - 1].to)) > 1e-8) {
      throw new Error("Disconnected route");
    }
    if (j) joinIndices.push(points.length - 1);
    for (let i = j ? 1 : 0; i <= steps; i++) {
      points.push(authoredPoint(segment, i / steps));
    }
  });
  if (points.length < 2) throw new Error("Empty route");
  const frames: Frame[] = [];
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const forward = unit(
      sub(
        points[Math.min(i + 1, points.length - 1)],
        points[Math.max(0, i - 1)],
      ),
    );
    const previous = frames[i - 1];
    let right: V3;
    if (previous) {
      s += length(sub(points[i], points[i - 1]));
      right = transport(previous.right, previous.forward, forward);
    } else {
      const reference: V3 = Math.abs(dot(forward, [0, 1, 0])) > 0.95
        ? [0, 0, 1]
        : [0, 1, 0];
      right = unit(cross(forward, reference));
    }
    frames.push({
      s,
      center: points[i],
      forward,
      right,
      up: unit(cross(right, forward)),
    });
  }
  return { frames, length: s, joins: joinIndices.map((i) => frames[i].s) };
}

/** Binary arc-length lookup with orthonormalized frame interpolation.
 * Beyond authored ends, straight tangent tails prevent clamped scenery folds.
 */
export function sample(route: Route, distance: number): Frame {
  const s = clamp(distance, 0, route.length);
  let lo = 0, hi = route.frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (route.frames[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const a = route.frames[lo], b = route.frames[hi];
  const t = (s - a.s) / (b.s - a.s);
  const forward = unit(mix(a.forward, b.forward, t));
  const r = mix(a.right, b.right, t);
  const right = unit(sub(r, mul(forward, dot(r, forward))));
  return {
    s: distance,
    center: add(mix(a.center, b.center, t), mul(forward, distance - s)),
    forward,
    right,
    up: unit(cross(right, forward)),
  };
}

export interface Mapping {
  readonly route: Route;
  /** Absolute distance, not player velocity or spline physics. Hold on pause. */
  readonly progress: number;
  /** 0 = rigid near patch; 1 = experimental fully curved combat patch. */
  readonly curve: number;
}
export interface SimPoint {
  readonly x: number;
  readonly y: number;
}
export const PX_PER_UNIT = 40;
export const PATCH_HALF = 8.5;

/** Near patch is EXACTLY planar at curve=0, including the six-pixel hitbox.
 * Distant scenery converges to the spline over 8.5–24 world units. Do not
 * use this morph for an unrestricted world: only the validated route window.
 */
export function simToWorld(mapping: Mapping, point: SimPoint, height = 0): V3 {
  const along = (PLAYFIELD.height / 2 - point.y) / PX_PER_UNIT;
  const lateral = (point.x - PLAYFIELD.width / 2) / PX_PER_UNIT;
  const anchor = sample(mapping.route, mapping.progress);
  const frame = sample(mapping.route, mapping.progress + along);
  const plane = add(
    add(anchor.center, mul(anchor.forward, along)),
    add(mul(anchor.right, lateral), mul(anchor.up, height)),
  );
  const ribbon = add(
    frame.center,
    add(mul(frame.right, lateral), mul(frame.up, height)),
  );
  const fade = smooth(
    clamp((Math.abs(along) - PATCH_HALF) / (24 - PATCH_HALF), 0, 1),
  );
  const amount = clamp(mapping.curve, 0, 1);
  return mix(plane, ribbon, amount + (1 - amount) * fade);
}

/** Local nearest projection for diagnostics/pointer candidates, NOT global
 * picking. Returns surface residual so callers can reject off-surface points.
 * Search is bounded to the visible +/-8-unit patch. Multi-hit rays need a
 * separate ray/surface solver and ambiguity rejection before live adoption.
 */
export function worldToSim(
  mapping: Mapping,
  world: V3,
): SimPoint & { residual: number } {
  const cost = (y: number) => {
    const center = simToWorld(mapping, { x: 240, y });
    const across = sub(simToWorld(mapping, { x: 280, y }), center);
    const lateral = dot(sub(world, center), across) / dot(across, across);
    const x = 240 + lateral * 40;
    return {
      x,
      y,
      residual: length(sub(simToWorld(mapping, { x, y }), world)),
    };
  };
  let best = cost(0);
  for (let y = 10; y <= 640; y += 10) {
    const candidate = cost(y);
    if (candidate.residual < best.residual) best = candidate;
  }
  let lo = Math.max(0, best.y - 10), hi = Math.min(640, best.y + 10);
  for (let i = 0; i < 45; i++) {
    const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
    if (cost(a).residual < cost(b).residual) hi = b;
    else lo = a;
  }
  return cost((lo + hi) / 2);
}

/** Stabilized orthographic diagnostic camera: transported right / forward.
 * Not a claim about the live 38-degree perspective camera. Coordinates are
 * sim-pixel equivalent, suitable for numerical Jacobian comparison.
 */
export function project(mapping: Mapping, world: V3): SimPoint {
  const f = sample(mapping.route, mapping.progress);
  const relative = sub(world, f.center);
  return {
    x: 240 + dot(relative, f.right) * 40,
    y: 320 - dot(relative, f.forward) * 40,
  };
}

/** Same analytic camera tilt as the harness perspective option. Pixel-
 * equivalent focal scale, not live viewport/DPR calibration. Useful for
 * exposing the distortion the orthographic guarantee does NOT cover.
 */
export function projectPerspective(mapping: Mapping, world: V3): SimPoint {
  const f = sample(mapping.route, mapping.progress);
  const relative = sub(world, f.center);
  const tilt = 0.47, distance = 32;
  const along = dot(relative, f.forward), vertical = dot(relative, f.up);
  const depth = distance - vertical * Math.cos(tilt) + along * Math.sin(tilt);
  if (depth <= 0) throw new Error("Behind camera");
  return {
    x: 240 + dot(relative, f.right) * 40 * distance / depth,
    y: 320 -
      (along * Math.cos(tilt) + vertical * Math.sin(tilt)) * 40 * distance /
        depth,
  };
}

/** Singular values and signed determinant of the projected local Jacobian. */
export function distortion(
  mapping: Mapping,
  p: SimPoint,
  projection = project,
) {
  const h = 0.1;
  const at = (x: number, y: number) =>
    projection(mapping, simToWorld(mapping, { x, y }));
  const a = at(p.x - h, p.y), b = at(p.x + h, p.y);
  const c = at(p.x, p.y - h), d = at(p.x, p.y + h);
  const xx = (b.x - a.x) / (2 * h), yx = (b.y - a.y) / (2 * h);
  const xy = (d.x - c.x) / (2 * h), yy = (d.y - c.y) / (2 * h);
  const trace = xx * xx + yx * yx + xy * xy + yy * yy;
  const determinant = xx * yy - xy * yx;
  const disc = Math.sqrt(
    Math.max(0, trace * trace - 4 * determinant * determinant),
  );
  const min = Math.sqrt(Math.max(0, (trace - disc) / 2));
  const max = Math.sqrt((trace + disc) / 2);
  return { min, max, anisotropy: max / min, determinant };
}
