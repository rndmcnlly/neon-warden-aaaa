/**
 * Enemy bullets as camera-facing glowing orbs, drawn with one instanced quad
 * per bullet. Bullet readability beats spectacle: these must stay the
 * clearest thing on screen. Each orb is a saturated pink or gold disc with
 * only a hint of white at its center, ringed by a dark rim, inside a soft
 * halo. The first pass used a white core with additive blending, and under
 * bloom every bullet read as the same cream blob; alpha blending is what
 * lets the rim actually darken what is behind it.
 *
 * Billboarding happens in the vertex shader: take the instance's world
 * position, move it to view space, then offset the quad corners there, so
 * every orb faces the camera whatever the rig is doing.
 */

export const orbVertex = /* glsl */ `
attribute vec3 aTint;
varying vec2 vUv;
varying vec3 vTint;

void main() {
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  // The instance scale (x) carries the orb radius.
  float radius = length(instanceMatrix[0].xyz);
  center.xy += position.xy * radius;
  gl_Position = projectionMatrix * center;
  vUv = uv;
  vTint = aTint;
}
`;

export const orbFragment = /* glsl */ `
uniform float uPulse;
varying vec2 vUv;
varying vec3 vTint;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float body = smoothstep(0.62, 0.56, r);
  // A dark rim keeps orbs readable over bright explosions and the Warden.
  float rim = body - smoothstep(0.5, 0.44, r);
  float halo = smoothstep(1.0, 0.6, r) * (1.0 - body);
  float hot = smoothstep(0.28, 0.0, r);
  // Slightly over 1.0 so bloom adds a tight glow without washing out hue.
  vec3 core = mix(vTint, vec3(1.0), 0.3 * hot) * (1.25 + 0.2 * uPulse);
  vec3 c = core * (body - rim) + vec3(0.04, 0.0, 0.06) * rim + vTint * halo;
  gl_FragColor = vec4(c, max(body, halo * 0.5));
}
`;
