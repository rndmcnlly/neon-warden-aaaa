/**
 * Enemy bullets as camera-facing rings, drawn with one instanced quad per
 * bullet. Bullet readability beats spectacle: these must stay the clearest
 * thing on screen.
 *
 * The shape is Ikaruga's: a dark, saturated center inside a bright colored
 * rim, so ownership is carried by shape (ring) and not only by hue. The rim
 * is drawn in HDR above the bloom threshold (palette.ts ROLE.dangerRim), so
 * it is one of the few things that glows; the center stays dark, so even a
 * dense cluster blooms as a lattice of rings rather than one white fog.
 * History: the first pass used a white core with additive blending, the
 * second a saturated disc; under bloom both read as cream blobs.
 *
 * Billboarding happens in the vertex shader: take the instance's world
 * position, move it to view space, then offset the quad corners there, so
 * every orb faces the camera whatever the rig is doing.
 */

export const orbVertex = /* glsl */ `
attribute vec3 aRim;
attribute vec3 aCore;
varying vec2 vUv;
varying vec3 vRim;
varying vec3 vCore;

void main() {
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  // The instance scale (x) carries the orb radius.
  float radius = length(instanceMatrix[0].xyz);
  center.xy += position.xy * radius;
  gl_Position = projectionMatrix * center;
  vUv = uv;
  vRim = aRim;
  vCore = aCore;
}
`;

export const orbFragment = /* glsl */ `
uniform float uPulse;
uniform float uRimGain;
varying vec2 vUv;
varying vec3 vRim;
varying vec3 vCore;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  // Ring: alpha = smoothstep(.5,.62,r) * (1 - smoothstep(.78,.9,r)).
  float ring = smoothstep(0.48, 0.6, r) * (1.0 - smoothstep(0.76, 0.88, r));
  float disc = 1.0 - smoothstep(0.86, 0.9, r);
  // A thin dark outline outside the ring separates touching bullets.
  float outline = smoothstep(0.86, 0.9, r) * (1.0 - smoothstep(0.94, 1.0, r));
  // A thin white-hot line on the ring's inner edge: the brightest small
  // pixels on screen belong to danger (the top of the value ladder).
  float hotLine = smoothstep(0.5, 0.56, r) * (1.0 - smoothstep(0.58, 0.64, r));
  vec3 c = vCore * (1.0 - ring) + vRim * ring * (uRimGain + 0.4 * uPulse);
  c = mix(c, vec3(2.2), hotLine * 0.8);
  float a = max(disc, outline * 0.8);
  c *= disc;
  gl_FragColor = vec4(c, a);
}
`;
