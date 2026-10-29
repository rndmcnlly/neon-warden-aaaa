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
 * - conduits: recessed channels along and across the lane, with dim data
 *   packets running both ways at their own speeds;
 * - signals: small lamps at major crossings that cycle slowly between a
 *   muted go, caution and off, like traffic lights seen from a tower;
 * - data flow: a faint pulse that now and then sweeps down a conduit;
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

/** Packets along a channel: dashes of length len every spacing units. */
float packets(float u, float spacing, float len) {
  float f = fract(u / spacing) * spacing;
  float aa = fwidth(u) + 0.02;
  float body = smoothstep(0.0, aa, f) * (1.0 - smoothstep(len - aa, len, f));
  // Brighter leading edge, so direction reads even when frozen.
  return body * (0.55 + 0.45 * f / len);
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
  // Whether a lamp lights this pixel, and which, kept apart so
  // the background budget below cannot grey the signals out.
  float lampLit = 0.0;
  float lampMask = 0.0;
  float lampCaution = 0.0;

  if (uDetail > 0.5) {
    // Plates: 2x2 panels, each a little lighter or darker, with seams.
    vec2 cell = floor(g / 2.0);
    c *= 0.88 + 0.22 * hash(cell);
    float seam = max(gridLine(g.x / 2.0 + 0.5, 0.0), gridLine(g.y / 2.0 + 0.5, 0.0));
    c *= 1.0 - 0.18 * seam;
    // Grain: fine, static relative to the floor.
    c *= 0.96 + 0.08 * hash(floor(g * 6.0));

    // Conduits along the lane (x = 4k + 2), recessed and darker...
    float kx = floor((g.x - 2.0) / 4.0 + 0.5);
    float along = channel(g.x - 2.0, 4.0, 0.2);
    c *= 1.0 - 0.45 * along;
    // ...each with its own packet stream, alternate lanes running up-lane.
    float dir = mod(kx, 2.0) < 0.5 ? 1.0 : -1.0;
    float speed = 1.0 + 1.8 * hash(vec2(kx, 3.0));
    float u = g.y + dir * speed * uTime + hash(vec2(kx, 7.0)) * 9.0;
    float run = packets(dir > 0.0 ? -u : u, 2.6 + 2.0 * hash(vec2(kx, 1.0)), 0.9);
    // Packets are thin light streaks down the channel's middle, like pulses
    // in a fibre, never blocks (blocks would read as debris or pickups).
    float core = channel(g.x - 2.0, 4.0, 0.05);
    c += uLine * 1.6 * core * run;
    // Data flow: now and then a soft pulse sweeps the whole conduit.
    float sweep = fract(uTime / 7.0 + hash(vec2(kx, 5.0)));
    float head = mix(uHalf.y + 2.0, -uHalf.y - 2.0, sweep);
    c += uLine * 0.5 * along * exp(-pow((p.y - head) * 0.9, 2.0));

    // Cross conduits (z = 8j + 4 on the floor), slower side traffic.
    float kz = floor((g.y - 4.0) / 8.0 + 0.5);
    float across = channel(g.y - 4.0, 8.0, 0.14);
    c *= 1.0 - 0.4 * across;
    float side = mod(kz, 2.0) < 0.5 ? 1.0 : -1.0;
    float v = g.x * side - (0.6 + 0.8 * hash(vec2(kz, 2.0))) * uTime;
    c += uLine * 1.2 * channel(g.y - 4.0, 8.0, 0.04) * packets(v, 3.4, 0.7);

    // Signals at major crossings: small square lamps cycling slowly
    // between a muted go, caution and off, out of step with each other.
    vec2 lamp = g / 4.0;
    vec2 lid = floor(lamp + 0.5);
    vec2 ld = abs(lamp - lid) * 4.0;
    lampMask = 1.0 - smoothstep(0.13, 0.13 + fwidth(g.x) * 1.5, max(ld.x, ld.y));
    float phase = floor(uTime / (2.5 + 2.0 * hash(lid)) + hash(lid + 9.0) * 3.0);
    float state = mod(phase, 3.0);
    lampLit = state < 2.0 ? lampMask : 0.0;
    lampCaution = step(1.0, state);

    // Reflection: the ship's engine smeared down-lane on the gloss.
    vec2 r = p - uPlayer - vec2(0.0, 0.9);
    c += uLine * 0.35 * exp(-(r.x * r.x * 6.0 + r.y * r.y * 0.45));
  }

  c += uLine * (minor * 0.22 + major * 0.8);

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
  // Signals: small, muted and dim (under uMax), but in their own hues.
  vec3 go = vec3(0.012, 0.075, 0.04);
  vec3 caution = vec3(0.085, 0.045, 0.006);
  c = mix(c, mix(go, caution, lampCaution), lampLit * fade);
  gl_FragColor = vec4(c, 1.0);
}
`;
