/**
 * The shield bubble: a fresnel rim (bright where the surface turns away from
 * the camera, clear in the middle so the ship stays visible) with a faint
 * scrolling hex lattice. `uHit` brightens it briefly when it absorbs a shot.
 */

export const shieldVertex = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec3 vLocal;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  vLocal = position;
  gl_Position = projectionMatrix * mv;
}
`;

export const shieldFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uHit;
varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec3 vLocal;

void main() {
  // Interpolated varyings are not unit length: clamp before pow, since a
  // negative base is NaN, and one NaN pixel turns the whole bloom black.
  float facing = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
  float fresnel = pow(1.0 - facing, 2.5);
  // Hex-ish lattice from three rotated stripe sets.
  vec2 p = vLocal.xz * 9.0 + vec2(0.0, uTime * 0.6);
  float a = abs(fract(p.x) - 0.5);
  float b = abs(fract(p.x * 0.5 + p.y * 0.866) - 0.5);
  float c = abs(fract(p.x * 0.5 - p.y * 0.866) - 0.5);
  float lattice = 1.0 - smoothstep(0.0, 0.06, min(a, min(b, c)));
  float intensity = fresnel * 1.6 + lattice * 0.18 + uHit * 0.8;
  gl_FragColor = vec4(uColor * intensity, intensity);
}
`;
