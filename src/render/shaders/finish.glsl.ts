/**
 * The final "lens" pass, after bloom: chromatic aberration, vignette, film
 * grain, and the full-screen flash. One pass instead of four keeps the
 * fill-rate cost low and the look tunable from one uniform block.
 *
 * The flash strength arrives already limited by `FlashGuard`, so this shader
 * never decides how bright a flash may be; it only draws what it is told.
 */

export const finishVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const finishFragment = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uAberration;  // radial RGB split at the corners, in UV units
uniform float uGrain;       // grain amplitude, 0-0.1
uniform float uVignette;    // 0 none, 1 heavy
uniform float uFlash;       // 0-1, pre-limited
uniform vec3 uFlashColor;
uniform float uDesaturate;  // 0-1, for the flashback's recorder look
varying vec2 vUv;

// Cheap hash noise; animated per frame so grain shimmers like film.
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 fromCenter = vUv - 0.5;
  float dist2 = dot(fromCenter, fromCenter);
  // Aberration grows toward the edges, like a real lens, and stays near zero
  // in the middle where bullets need to be crisp.
  vec2 shift = fromCenter * dist2 * uAberration * 40.0;
  vec3 col;
  col.r = texture2D(tDiffuse, vUv + shift).r;
  col.g = texture2D(tDiffuse, vUv).g;
  col.b = texture2D(tDiffuse, vUv - shift).b;

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * vec3(0.85, 1.0, 1.05), uDesaturate);

  float vig = smoothstep(0.85, 0.2, dist2 * (1.0 + uVignette * 2.2));
  col *= mix(1.0, vig, uVignette);

  col += uFlashColor * uFlash;

  float g = hash(vUv * 1024.0 + fract(uTime * 7.31)) - 0.5;
  col += g * uGrain;

  gl_FragColor = vec4(col, 1.0);
}
`;
