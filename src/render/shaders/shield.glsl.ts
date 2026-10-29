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
  float fresnel = pow(1.0 - abs(dot(vNormalV, vViewDir)), 2.5);
  // Hex-ish lattice from three rotated stripe sets.
  vec2 p = vLocal.xz * 9.0 + vec2(0.0, uTime * 0.6);
  float a = abs(fract(p.x) - 0.5);
  float b = abs(fract(p.x * 0.5 + p.y * 0.866) - 0.5);
  float c = abs(fract(p.x * 0.5 - p.y * 0.866) - 0.5);
  float lattice = smoothstep(0.06, 0.0, min(a, min(b, c)));
  float intensity = fresnel * 1.6 + lattice * 0.18 + uHit * 0.8;
  gl_FragColor = vec4(uColor * intensity, intensity);
}
`;
