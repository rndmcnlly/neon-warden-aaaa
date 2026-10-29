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
  c += uLine * (minor * 0.18 + major * 0.55);

  float dp = length(p - uPlayer);
  c += uLine * 0.5 * exp(-dp * dp * 0.9);
  float db = length((p - uBoss) * vec2(0.5, 0.8));
  c += uLine * 0.6 * exp(-db * db * 0.25) * uBossOn;

  // Busy-moment column around the player lane.
  float col = exp(-pow((p.x - uPlayer.x) * 0.35, 2.0));
  c *= 1.0 - 0.35 * uDensity * col;

  gl_FragColor = vec4(c * uBright * fade, 1.0);
}
`;
