/**
 * GPU particles. The CPU writes each particle once, at birth (start position,
 * velocity, birth time, lifetime, color, size), into a ring buffer; from then
 * on the vertex shader computes where it is from `uTime` alone. No per-frame
 * CPU work per particle, so a Warden death of thousands of sparks costs the
 * same as one.
 *
 * GLSL lives in `.glsl.ts` modules (a template string per stage) so Vite and
 * `deno check` both handle it without loader plugins.
 */

export const particleVertex = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute vec3 aVelocity;
attribute vec3 aColor;
attribute vec3 aBirthLifeSize; // birth time (s), lifetime (s), size (world)
varying vec3 vColor;
varying float vFade;

void main() {
  float age = uTime - aBirthLifeSize.x;
  float life = aBirthLifeSize.y;
  float t = clamp(age / life, 0.0, 1.0);
  // Unborn or dead particles collapse to nothing (and get clipped).
  float alive = step(0.0, age) * step(age, life);

  // Exponential drag: sparks burst out fast and hang in the air.
  float drag = 2.2;
  vec3 travel = aVelocity * (1.0 - exp(-drag * age)) / drag;
  vec3 pos = position + travel;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = aBirthLifeSize.z * (1.0 - t * 0.7);
  gl_PointSize = alive * size * uPixelRatio * 420.0 / -mv.z;
  vColor = aColor;
  vFade = alive * (1.0 - t) * (1.0 - t);
}
`;

export const particleFragment = /* glsl */ `
varying vec3 vColor;
varying float vFade;

void main() {
  // Soft round sprite: white-hot center, colored falloff, like the original.
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) discard;
  float glow = exp(-r2 * 4.0);
  float core = exp(-r2 * 22.0);
  vec3 c = vColor * glow * 2.0 + vec3(core) * 1.5;
  gl_FragColor = vec4(c * vFade, 1.0);
}
`;
