import { assert, assertEquals } from "@std/assert";
import { readGlb } from "../qa/lib/gltf.ts";

/** A minimal GLB: one triangle, one node, built in memory. */
function tinyGlb(json: object, binBytes = 36): Uint8Array {
  const pad = (n: number) => (n + 3) & ~3;
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = pad(jsonBytes.byteLength);
  const binLen = pad(binBytes);
  const total = 12 + 8 + jsonLen + 8 + binLen;
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, total, true);
  v.setUint32(12, jsonLen, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLen);
  out.set(jsonBytes, 20);
  v.setUint32(20 + jsonLen, binLen, true);
  v.setUint32(24 + jsonLen, 0x004e4942, true);
  return out;
}

const TRIANGLE = {
  asset: { version: "2.0", generator: "test" },
  buffers: [{ byteLength: 36 }],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  accessors: [{ bufferView: 0, count: 3 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  nodes: [{ name: "crown", mesh: 0 }, { name: "turret" }],
};

Deno.test("reads triangles and node names from a valid GLB", () => {
  const glb = readGlb(tinyGlb(TRIANGLE));
  assert(glb.ok, glb.errors.join("; "));
  assertEquals(glb.triangles, 1);
  assertEquals(glb.nodes, ["crown", "turret"]);
});

Deno.test("flags a buffer view that runs past its buffer", () => {
  const bad = { ...TRIANGLE, bufferViews: [{ buffer: 0, byteLength: 99 }] };
  const glb = readGlb(tinyGlb(bad));
  assert(!glb.ok);
  assert(glb.errors.some((e) => e.includes("bufferView 0")));
});

Deno.test("rejects non-GLB bytes", () => {
  assert(!readGlb(new TextEncoder().encode("not a model at all!!")).ok);
});
