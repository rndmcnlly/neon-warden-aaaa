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
uniform vec4 uWave;         // Writ pressure wave: centre uv, radius, strength
uniform float uAspect;      // width / height, so the wave is round
uniform float uHurt;        // 0-1, player-damage pulse: red edge vignette
uniform float uEdge;        // 1 -> 0, life lost: a red frame closing inward
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
  // Writ pressure wave: a thin refracting band pushes the image outward.
  // Displacement only, no added light, so it is not a flash.
  vec2 uv = vUv;
  if (uWave.w > 0.0) {
    vec2 d = vUv - uWave.xy;
    d.x *= uAspect;
    float r = max(length(d), 1e-4);
    float band = exp(-pow((r - uWave.z) / 0.03, 2.0));
    vec2 dir = d / r;
    dir.x /= uAspect;
    uv -= dir * band * uWave.w;
  }
  // Aberration grows toward the edges, like a real lens, and stays near zero
  // in the middle where bullets need to be crisp.
  vec2 shift = fromCenter * dist2 * uAberration * 40.0;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + shift).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - shift).b;

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * vec3(0.85, 1.0, 1.05), uDesaturate);

  float vig = smoothstep(0.85, 0.2, dist2 * (1.0 + uVignette * 2.2));
  col *= mix(1.0, vig, uVignette);

  // Damage pulse: the edges bleed red, the center stays readable.
  col = mix(col, col * 0.5 + vec3(0.35, 0.02, 0.06), uHurt * smoothstep(0.05, 0.3, dist2));

  // Life lost: a hard-edged rectangular frame (a different shape from the
  // round hurt vignette) that sweeps inward as it fades.
  if (uEdge > 0.0) {
    vec2 a = abs(fromCenter) * 2.0;
    float m = max(a.x, a.y);
    float front = 1.0 - (1.0 - uEdge) * 0.25 - 0.04;
    float band = smoothstep(front - 0.05, front, m);
    col = mix(col, vec3(0.9, 0.06, 0.1), band * uEdge);
  }

  col += uFlashColor * uFlash;

  float g = hash(vUv * 1024.0 + fract(uTime * 7.31)) - 0.5;
  col += g * uGrain;

  gl_FragColor = vec4(col, 1.0);
}
`;
