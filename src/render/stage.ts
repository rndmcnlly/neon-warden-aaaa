/**
 * STUB renderer (Workstream 0): a three.js canvas with one spinning
 * placeholder. Workstream 3 replaces this with the real scene, which reads
 * `SimState` each frame and never writes it.
 */

import * as THREE from "three";

export interface Stage {
  /** Draws one frame; `dtMs` is wall time since the previous frame. */
  render(dtMs: number): void;
}

export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(globalThis.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#04020c");
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 4);

  // Cyan wireframe to echo the original's #5ef2ff neon outlines.
  const placeholder = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: "#5ef2ff", wireframe: true }),
  );
  scene.add(placeholder);

  function resize(): void {
    const { clientWidth: width, clientHeight: height } = container;
    renderer.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
  globalThis.addEventListener("resize", resize);
  resize();

  return {
    render(dtMs) {
      placeholder.rotation.x += dtMs * 0.0004;
      placeholder.rotation.y += dtMs * 0.0007;
      renderer.render(scene, camera);
    },
  };
}
