/**
 * The deep-space backdrop: a big plane far below the playfield painted with
 * fractal noise in the original's three nebula colors (violet, pink, cyan).
 * It scrolls toward the camera so the lanes feel flown through rather than
 * painted on, and `uWarp` stretches it for the warp-jump moments.
 */

export const nebulaVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const nebulaFragment = /* glsl */ `
uniform float uScroll;
uniform float uWarp;
uniform vec3 uViolet;
uniform vec3 uPink;
uniform vec3 uCyan;
uniform vec3 uVoid;
uniform float uCap;  // value cap, keeps the nebula under bullet values
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vUv * vec2(3.0, 6.0);
  p.y += uScroll;
  p.y *= 1.0 / (1.0 + uWarp * 4.0);
  float n1 = fbm(p * 0.8);
  float n2 = fbm(p * 1.3 + vec2(4.0, 0.0));
  float n3 = fbm(p * 0.6 + vec2(0.0, 7.0));
  vec3 c = uVoid;
  c += uViolet * smoothstep(0.45, 0.9, n1) * 0.55;
  c += uPink * smoothstep(0.55, 0.95, n2) * 0.35;
  c += uCyan * smoothstep(0.6, 0.95, n3) * 0.25;
  // Fade the edges of the plane into the void so no border ever shows.
  vec2 e = abs(vUv - 0.5) * 2.0;
  c = mix(c, uVoid, smoothstep(0.6, 1.0, max(e.x, e.y)));
  float v = max(c.r, max(c.g, c.b));
  c *= min(1.0, uCap / max(v, 1e-4));
  gl_FragColor = vec4(c, 1.0);
}
`;
