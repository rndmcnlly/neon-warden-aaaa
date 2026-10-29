/**
 * The lane floor: a scrolling grid plane just under the playfield (the Rez
 * move, critique item 5). It is the frame's midtone band: a low-saturation
 * world-hue base at a mid value, grid lines a step brighter, both fading
 * with distance from the playfield so the far field still falls to void.
 *
 * Two soft ground glows sit under the player and the boss (contact light
 * that tells you where things are in depth). Under heavy bullet density, a
 * column around the player darkens a little so rings read against it
 * (critique item 10).
 *
 * Activity (night plan item 9, Argon idea 5: "sub-surface conduit traffic"):
 * the lane is a working road, so it carries
 * - plates: panel-to-panel brightness variation, seams and a fine grain;
 * - conduits: recessed channels along and across the lane;
 * - data flow: a long, soft swell drifting slowly down each conduit;
 * - signals: large, dim go or caution pools at some major crossings,
 *   breathing over several seconds;
 * - a reflection: the ship's engine smeared down-lane on the glossy floor.
 *
 * All of it is background. Every layer is added at a fraction of the line
 * hue, and the result is pulled toward grey (`uSat`) and soft-capped in
 * value (`uMax`) so it stays below combat in value and saturation (see
 * research/2026-10-29-movement-lane/ for the measured frames). Motion runs
 * on `uTime`, which the backdrop freezes under reduced motion. `uDetail` 0
 * (the low tier) skips the per-pixel activity loops.
 */

export const floorVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const floorFragment = /* glsl */ `
uniform vec3 uBase;       // world hue A, linear
uniform vec3 uLine;       // world hue B, linear
uniform float uBright;    // scene floor multiplier
uniform float uScroll;    // world units scrolled toward +Z
uniform float uTime;      // activity clock, seconds (frozen: reduced motion)
uniform float uDetail;    // 1: full activity; 0: low tier, grid only
uniform float uSat;       // 0-1: how much of the hue survives
uniform float uMax;       // soft value cap, linear
uniform float uGain;      // overall floor level (background budget)
uniform vec2 uPlayer;     // xz
uniform vec2 uBoss;       // xz
uniform float uBossOn;
uniform float uDensity;   // 0-1 enemy bullet density
uniform vec2 uHalf;       // playfield half extents (x, z)
varying vec3 vWorld;

float gridLine(float v, float width) {
  float f = abs(fract(v) - 0.5);
  float w = fwidth(v) * 1.2 + width;
  return 1.0 - smoothstep(0.5 - w, 0.5, f);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

/** A channel of half-width w centered on every multiple of period. */
float channel(float v, float period, float w) {
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float aa = fwidth(v);
  return 1.0 - smoothstep(w - aa, w + aa, d);
}

void main() {
  vec2 p = vWorld.xz;
  // Distance outside the playfield rectangle, so the field itself is evenly lit.
  vec2 out2 = max(abs(p) - uHalf, 0.0);
  float far = length(out2);
  float fade = exp(-far * 0.22);
  // A gentle vertical gradient: brighter toward the player's end.
  float grad = mix(0.75, 1.1, smoothstep(-uHalf.y, uHalf.y, p.y));

  vec2 g = vec2(p.x, p.y - uScroll);
  float minor = max(gridLine(g.x, 0.0), gridLine(g.y, 0.0));
  float major = max(gridLine(g.x / 4.0, 0.0), gridLine(g.y / 4.0, 0.0));

  vec3 c = uBase * grad;
  // Signal glow strength and hue, kept apart so the background
  // budget below cannot grey the signals out.
  float lampLit = 0.0;
  float lampCaution = 0.0;

  if (uDetail > 0.5) {
    // Plates: 2x2 panels, each a little lighter or darker, with seams.
    vec2 cell = floor(g / 2.0);
    c *= 0.88 + 0.22 * hash(cell);
    float seam = max(gridLine(g.x / 2.0 + 0.5, 0.0), gridLine(g.y / 2.0 + 0.5, 0.0));
    c *= 1.0 - 0.18 * seam;
    // Grain: fine, static relative to the floor.
    c *= 0.96 + 0.08 * hash(floor(g * 6.0));

    // Conduits along the lane (x = 4k + 2), recessed and darker.
    float kx = floor((g.x - 2.0) / 4.0 + 0.5);
    float along = channel(g.x - 2.0, 4.0, 0.2);
    c *= 1.0 - 0.45 * along;
    // Data flow: a long, soft swell drifting slowly down each conduit,
    // several world units long, so it reads as current, never as a mark.
    // (Thin bright packets and lamps were cut on October 29, 2026: a blind
    // observer read them as bullets and pickups; morning-fix README.)
    float flow = 0.5 + 0.5 * sin(g.y * 0.35 + uTime * (0.4 + 0.3 * hash(vec2(kx, 3.0))) + hash(vec2(kx, 7.0)) * 6.28);
    c += uLine * 0.22 * along * flow * flow;

    // Cross conduits (z = 8j + 4 on the floor), recessed, no traffic.
    float kz = floor((g.y - 4.0) / 8.0 + 0.5);
    float across = channel(g.y - 4.0, 8.0, 0.14);
    c *= 1.0 - 0.4 * across;

    // Signal glows: large, dim pools at some major crossings, breathing
    // over many seconds (no small lamps: those read as pickups).
    vec2 lid = floor(g / 8.0 + 0.5);
    vec2 ld = g - lid * 8.0;
    float breath = 0.5 + 0.5 * sin(uTime * 0.25 + hash(lid) * 6.28);
    float pool = exp(-dot(ld, ld) * 0.12) * step(0.5, hash(lid + 4.0));
    lampLit = pool * breath;
    lampCaution = step(0.5, hash(lid + 9.0));

    // Reflection: the ship's engine smeared down-lane on the gloss.
    vec2 r = p - uPlayer - vec2(0.0, 0.9);
    c += uLine * 0.35 * exp(-(r.x * r.x * 6.0 + r.y * r.y * 0.45));
  }

  // Grid lines stay faint: the major lines were the brightest thin marks
  // on the floor and read as scrolling dashes.
  c += uLine * (minor * 0.12 + major * 0.35);

  float dp = length(p - uPlayer);
  c += uLine * 0.4 * exp(-dp * dp * 0.9);
  float db = length((p - uBoss) * vec2(0.5, 0.8));
  c += uLine * 0.6 * exp(-db * db * 0.25) * uBossOn;

  // Busy-moment column around the player lane.
  float col = exp(-pow((p.x - uPlayer.x) * 0.35, 2.0));
  c *= 1.0 - 0.35 * uDensity * col;

  c *= uBright * fade * uGain;
  // Background budget: pull toward grey, then a soft knee: untouched up
  // to 60% of uMax, compressed toward uMax above it, so bright activity
  // flattens instead of competing with combat.
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, uSat);
  float knee = 0.6 * uMax;
  vec3 over = max(c - knee, 0.0);
  c = min(c, vec3(knee)) + over * (uMax - knee) / (uMax - knee + over);
  // Signal glows: dim, soft and in their own muted hues, added after the
  // budget at a level well under uMax.
  vec3 go = vec3(0.004, 0.022, 0.012);
  vec3 caution = vec3(0.024, 0.013, 0.002);
  c += mix(go, caution, lampCaution) * lampLit * fade;
  gl_FragColor = vec4(c, 1.0);
}
`;
