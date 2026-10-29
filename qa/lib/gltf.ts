/**
 * A light GLB reader for the asset report: structural validity, triangle
 * count and node names, with no dependencies. It is not the Khronos
 * validator (which also checks accessor bounds against min/max, extension
 * schemas, and more); it catches what our pipeline actually breaks:
 * truncated files, wrong containers, buffer views out of range, and missing
 * animated nodes.
 */

export interface GlbSummary {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly triangles: number;
  readonly nodes: readonly string[];
  readonly materials: readonly string[];
  readonly generator: string;
}

interface GltfJson {
  asset?: { version?: string; generator?: string };
  buffers?: { byteLength: number; uri?: string }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[];
  accessors?: { bufferView?: number; count: number }[];
  meshes?: {
    primitives: {
      indices?: number;
      mode?: number;
      attributes: Record<string, number>;
    }[];
  }[];
  nodes?: { name?: string; mesh?: number }[];
  materials?: { name?: string }[];
}

const MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export function readGlb(bytes: Uint8Array): GlbSummary {
  const errors: string[] = [];
  const fail = (e: string): GlbSummary => ({
    ok: false,
    errors: [...errors, e],
    triangles: 0,
    nodes: [],
    materials: [],
    generator: "",
  });
  if (bytes.byteLength < 20) return fail("file shorter than a GLB header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) return fail("not a GLB (bad magic)");
  if (view.getUint32(4, true) !== 2) {
    return fail("GLB container version is not 2");
  }
  const length = view.getUint32(8, true);
  if (length !== bytes.byteLength) {
    errors.push(`header length ${length} != file size ${bytes.byteLength}`);
  }

  let json: GltfJson | null = null;
  let binLength = 0;
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + chunkLength > bytes.byteLength) {
      return fail("chunk runs past end of file");
    }
    if (type === CHUNK_JSON) {
      try {
        json = JSON.parse(
          new TextDecoder().decode(bytes.subarray(start, start + chunkLength)),
        );
      } catch {
        return fail("JSON chunk does not parse");
      }
    } else if (type === CHUNK_BIN) {
      binLength = chunkLength;
    }
    offset = start + chunkLength;
  }
  if (!json) return fail("no JSON chunk");
  if (json.asset?.version !== "2.0") {
    errors.push(`asset.version is ${json.asset?.version}`);
  }

  const buffers = json.buffers ?? [];
  buffers.forEach((b, i) => {
    if (b.uri) {
      errors.push(
        `buffer ${i} is external (${b.uri}); GLBs must be self-contained`,
      );
    } else if (b.byteLength > binLength) {
      errors.push(`buffer ${i} longer than BIN chunk`);
    }
  });
  (json.bufferViews ?? []).forEach((bv, i) => {
    const buf = buffers[bv.buffer];
    if (!buf) errors.push(`bufferView ${i} names missing buffer ${bv.buffer}`);
    else if ((bv.byteOffset ?? 0) + bv.byteLength > buf.byteLength) {
      errors.push(`bufferView ${i} runs past its buffer`);
    }
  });
  const accessors = json.accessors ?? [];
  accessors.forEach((a, i) => {
    if (a.bufferView !== undefined && !json!.bufferViews?.[a.bufferView]) {
      errors.push(`accessor ${i} names missing bufferView ${a.bufferView}`);
    }
  });

  // Triangles per mesh, counted once per node instance that uses the mesh.
  const meshTris = (json.meshes ?? []).map((mesh) =>
    mesh.primitives.reduce((sum, p) => {
      const mode = p.mode ?? 4;
      const count = p.indices !== undefined
        ? accessors[p.indices]?.count ?? 0
        : accessors[p.attributes.POSITION]?.count ?? 0;
      if (mode === 4) return sum + Math.floor(count / 3);
      if (mode === 5 || mode === 6) return sum + Math.max(0, count - 2);
      return sum;
    }, 0)
  );
  const nodes = json.nodes ?? [];
  const triangles = nodes.reduce(
    (sum, n) => sum + (n.mesh !== undefined ? meshTris[n.mesh] ?? 0 : 0),
    0,
  );

  return {
    ok: errors.length === 0,
    errors,
    triangles,
    nodes: nodes.map((n) => n.name ?? "").filter((n) => n !== "").sort(),
    materials: (json.materials ?? []).map((m) => m.name ?? "").sort(),
    generator: json.asset?.generator ?? "",
  };
}
