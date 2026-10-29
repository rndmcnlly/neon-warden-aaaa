/** Intentionally isolated, dev-only display labels are not shipped game text. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  add,
  buildRoute,
  distortion,
  type Mapping,
  mul,
  sample,
  type SimPoint,
  simToWorld,
  type V3,
} from "./math.ts";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const route = buildRoute();
const flat = buildRoute([{
  name: "Flat",
  from: [0, 0, 0],
  to: [0, 0, -route.length],
}]);
const slider = $<HTMLInputElement>("progress");
slider.max = String(route.length - 12);
const curve = $<HTMLInputElement>("curve");
const reduced = $<HTMLInputElement>("reduced");
reduced.checked = matchMedia("(prefers-reduced-motion: reduce)").matches;
const cameraChoice = $<HTMLSelectElement>("camera");
const panel = $<HTMLSelectElement>("panel");
function choosePanel() {
  const sections = document.querySelectorAll<HTMLElement>(".view");
  sections[0].hidden = panel.value === "ribbon";
  sections[1].hidden = panel.value === "flat";
  $("views").style.gridTemplateColumns =
    panel.value === "both" && innerWidth > 600 ? "1fr 1fr" : "1fr";
}
if (innerWidth <= 600) panel.value = "ribbon";
panel.onchange = choosePanel;
choosePanel();
let paused = false, start = performance.now(), offset = 0;
$("pause").onclick = () => {
  paused = !paused;
  $("pause").textContent = paused ? "Resume survey" : "Pause survey";
};
slider.oninput = () => {
  paused = true;
  $("pause").textContent = "Resume survey";
};

interface Anchor {
  object: THREE.Object3D;
  point: SimPoint;
  height: number;
}
function createView(id: string) {
  const canvas = $<HTMLCanvasElement>(id);
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (error) {
    $("status").textContent =
      "WebGL unavailable in this browser. This harness requires WebGL2; use the saved Metal-Chromium captures instead. No live-game fallback was tested.";
    throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x081420);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xc4eaff, 0x182838, 3));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(10, 30, 10);
  scene.add(light);
  const anchors: Anchor[] = [];
  const linePoints: { points: SimPoint[]; line: THREE.Line; height: number }[] =
    [];
  const makeLine = (points: SimPoint[], color: number, height = 0) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(points.length * 3), 3),
    );
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color }),
    );
    line.frustumCulled = false;
    scene.add(line);
    linePoints.push({ points, line, height });
  };
  // Route-context grid, including distant bends outside the combat patch.
  for (let x = -120; x <= 600; x += 120) {
    makeLine(
      Array.from({ length: 121 }, (_, i) => ({ x, y: -880 + i * 20 })),
      0x204657,
    );
  }
  for (let y = -880; y <= 1520; y += 160) {
    makeLine(
      Array.from({ length: 25 }, (_, i) => ({ x: -120 + i * 30, y })),
      0x204657,
    );
  }
  makeLine([{ x: 0, y: 0 }, { x: 480, y: 0 }, { x: 480, y: 640 }, {
    x: 0,
    y: 640,
  }, { x: 0, y: 0 }], 0x44c795);
  // Frozen fake scan event and focus geometry, always mapped pointwise.
  const player = { x: 240, y: 540 };
  const arc = Array.from({ length: 25 }, (_, i) => {
    const angle = -0.36 + i / 24 * 0.72;
    return {
      x: player.x + Math.sin(angle) * 210,
      y: player.y - Math.cos(angle) * 210,
    };
  });
  makeLine([player, ...arc, player], 0x43daee, 0.025);
  for (const sign of [-1, 1]) {
    makeLine(
      [{ x: 240 + sign * 19, y: 548 }, { x: 240 + sign * 24, y: 548 }, {
        x: 240 + sign * 24,
        y: 532,
      }, { x: 240 + sign * 19, y: 532 }],
      0x43daee,
      0.04,
    );
  }
  makeLine([{ x: 240, y: 540 }, { x: 240, y: 170 }], 0xfff3aa, 0.035);
  makeLine(
    [{ x: 228, y: 170 }, { x: 252, y: 170 }, { x: 240, y: 158 }, {
      x: 228,
      y: 170,
    }],
    0xffffff,
    0.035,
  );
  makeLine(
    [{ x: 324, y: 220 }, { x: 360, y: 206 }, { x: 388, y: 206 }],
    0x43daee,
    0.05,
  );
  let models = 0;
  function model(
    file: string,
    point: SimPoint,
    footprint: number,
    color: number,
  ) {
    const slot = new THREE.Group();
    scene.add(slot);
    anchors.push({ object: slot, point, height: 0.01 });
    const placeholder = new THREE.Mesh(
      new THREE.ConeGeometry(footprint / 80, footprint / 40, 4),
      new THREE.MeshStandardMaterial({ color }),
    );
    placeholder.rotation.x = -Math.PI / 2;
    slot.add(placeholder);
    new GLTFLoader().load(`/models/${file}.glb`, (gltf) => {
      const object = gltf.scene;
      const size = new THREE.Box3().setFromObject(object).getSize(
        new THREE.Vector3(),
      );
      object.scale.multiplyScalar(footprint / 40 / Math.max(size.x, size.z));
      slot.remove(placeholder);
      placeholder.geometry.dispose();
      (placeholder.material as THREE.Material).dispose();
      slot.add(object);
      models++;
    });
  }
  model("pilot_ship", player, 46, 0x44ffff);
  model("drone", { x: 120, y: 140 }, 40, 0xff8844);
  model("lancer", { x: 340, y: 220 }, 50, 0xff8844);
  model("pickup_shield", { x: 170, y: 360 }, 22, 0x44eeaa);
  for (let i = 0; i < 16; i++) {
    const bullet = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffaa44 }),
    );
    scene.add(bullet);
    anchors.push({
      object: bullet,
      point: { x: 55 + i * 24, y: 280 + Math.sin(i) * 35 },
      height: 0.04,
    });
  }
  const hitbox = new THREE.Mesh(
    new THREE.CircleGeometry(6 / 40, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
  );
  hitbox.rotation.x = -Math.PI / 2;
  const hitSlot = new THREE.Group();
  hitSlot.add(hitbox);
  scene.add(hitSlot);
  anchors.push({ object: hitSlot, point: player, height: 0.3 });
  // Two distant industrial gate wireframes, not a second scenery system.
  for (const y of [-720, -240]) {
    makeLine(
      [{ x: -80, y }, { x: -80, y: y - 80 }, { x: 560, y: y - 80 }, {
        x: 560,
        y,
      }],
      0xcb8c47,
      1.5,
    );
  }
  function draw(mapping: Mapping) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const f = sample(mapping.route, mapping.progress);
    for (const anchor of anchors) {
      anchor.object.position.fromArray(
        simToWorld(mapping, anchor.point, anchor.height),
      );
      const local = sample(
        mapping.route,
        mapping.progress + (320 - anchor.point.y) / 40,
      );
      const orientation = mapping.curve ? local : f;
      const basis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...orientation.right),
        new THREE.Vector3(...orientation.up),
        new THREE.Vector3(...mul(orientation.forward, -1)),
      );
      anchor.object.quaternion.setFromRotationMatrix(basis);
    }
    for (const entry of linePoints) {
      const attribute = entry.line.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      entry.points.forEach((p, i) =>
        attribute.setXYZ(i, ...simToWorld(mapping, p, entry.height))
      );
      attribute.needsUpdate = true;
    }
    const aspect = w / h;
    const extent = Math.max(22, 15 / aspect);
    const perspective = cameraChoice.value === "perspective";
    const camera = perspective
      ? new THREE.PerspectiveCamera(38, aspect, 0.1, 300)
      : new THREE.OrthographicCamera(
        -extent * aspect / 2,
        extent * aspect / 2,
        extent / 2,
        -extent / 2,
        0.1,
        300,
      );
    const tilt = perspective ? 0.47 : 0;
    const distance = perspective
      ? extent / (2 * Math.tan(38 * Math.PI / 360))
      : 40;
    const eye: V3 = add(
      f.center,
      add(
        mul(f.up, Math.cos(tilt) * distance),
        mul(f.forward, -Math.sin(tilt) * distance),
      ),
    );
    camera.position.fromArray(eye);
    camera.up.fromArray(f.forward);
    camera.lookAt(...f.center);
    renderer.render(scene, camera);
  }
  return { draw, models: () => models };
}
const views = [createView("flat"), createView("ribbon")];
let frames = 0;
function animate(now: number) {
  const delta = Math.min(0.1, (now - start) / 1000);
  start = now;
  if (!paused && !reduced.checked) {
    offset += delta;
    slider.value = String(12 + (offset % 12) / 12 * (route.length - 24));
  }
  const progress = reduced.checked ? 40 : Number(slider.value);
  const mapping: Mapping = {
    route: reduced.checked ? flat : route,
    progress,
    curve: curve.checked && !reduced.checked ? 1 : 0,
  };
  views[0].draw({ route: flat, progress, curve: 0 });
  views[1].draw(mapping);
  const metrics = distortion(mapping, { x: 240, y: 540 });
  const segment = route.joins.filter((s) => s < progress).length;
  $("status").textContent = `${
    ["Industrial sweep", "Rising gate", "Boss arena"][segment]
  } | s=${progress.toFixed(1)} wu | player ortho Jacobian ${
    metrics.min.toFixed(4)
  }–${metrics.max.toFixed(4)} | glTF loaded ${
    views.map((v) => v.models()).join("/")
  } of 4 each. ${
    cameraChoice.value === "perspective"
      ? "Perspective is a visual warning, not covered by ortho bounds."
      : "Ortho bounds only."
  }`;
  (globalThis as unknown as { routeHarness: unknown }).routeHarness = {
    frames: ++frames,
    progress,
    models: views.map((v) => v.models()),
    frozenTick: 420,
    silent: true,
  };
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
