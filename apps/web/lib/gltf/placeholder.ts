import { toBase64 } from "./base64";
import { earClip, withoutRepeats } from "./ear-clip";
import { TEXTURE_SIZE, type LayoutPanel, type PanelGroup, type PanelLayout } from "./layout";
import type { GltfAccessor, GltfBufferView, GltfMaterial, GltfModel, GltfNode } from "./types";

export type { GltfModel } from "./types";

export const PLACEHOLDER_LABEL = "placeholder, not an artist model";
export const MODEL_UNITS = "glTF positions in metres; panel layout in millimetres";
const GENERATOR = "Knitwright placeholder generator";
const THICKNESS_M = 0.004;
const MM = 1e-3;
const GROUPS: readonly PanelGroup[] = ["body", "sleeve", "collar"];

interface PanelMesh {
  readonly positions: number[];
  readonly uvs: number[];
  readonly indices: number[];
}

/** Where a panel stands in the placeholder: flat shapes around the body, only so the pieces can be told apart. */
function stand(id: LayoutPanel["id"]): Pick<GltfNode, "translation" | "rotation"> {
  switch (id) {
    case "front":
      return { translation: [0, 0, 0.05] };
    case "back":
      return { translation: [0, 0, -0.05], rotation: [0, 1, 0, 0] };
    case "sleeve-left":
      return { translation: [0.45, 0, 0] };
    case "sleeve-right":
      return { translation: [-0.45, 0, 0] };
    default:
      return { translation: [0, 0.4, 0] };
  }
}

/** One panel: the outline filled on the front face and the back face, and a wall along every edge. UVs are the layout's. */
function panelMesh(panel: LayoutPanel): PanelMesh {
  const ring = withoutRepeats(panel.outline);
  const { rect } = panel;
  const uv = (p: readonly [number, number]): [number, number] => [
    rect.u0 + (p[0] / panel.widthMm) * (rect.u1 - rect.u0),
    rect.v1 - (p[1] / panel.heightMm) * (rect.v1 - rect.v0),
  ];
  const at = (p: readonly [number, number], z: number): number[] => [(p[0] - panel.widthMm / 2) * MM, (p[1] - panel.heightMm / 2) * MM, z];
  const half = THICKNESS_M / 2;
  const mesh: PanelMesh = { positions: [], uvs: [], indices: [] };
  const add = (p: readonly [number, number], z: number): number => {
    mesh.positions.push(...at(p, z));
    mesh.uvs.push(...uv(p));
    return mesh.uvs.length / 2 - 1;
  };
  const front = ring.map((p) => add(p, half));
  const back = ring.map((p) => add(p, -half));
  for (const [a, b, c] of earClip(ring)) {
    mesh.indices.push(front[a] as number, front[b] as number, front[c] as number, back[a] as number, back[c] as number, back[b] as number);
  }
  const anticlockwise = ring.reduce((s, p, i) => s + p[0] * (ring[(i + 1) % ring.length] as readonly number[])[1]! - (ring[(i + 1) % ring.length] as readonly number[])[0]! * p[1], 0) > 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length] as readonly [number, number];
    const [a, b, c, d] = [add(p, half), add(q, half), add(q, -half), add(p, -half)] as [number, number, number, number];
    mesh.indices.push(...(anticlockwise ? [a, d, c, a, c, b] : [a, c, d, a, b, c]));
  });
  return mesh;
}

function bounds(values: readonly number[]): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  values.forEach((v, i) => {
    min[i % 3] = Math.min(min[i % 3] as number, v);
    max[i % 3] = Math.max(max[i % 3] as number, v);
  });
  return { min, max };
}

/** Writes numbers into one binary block and returns the views and accessors that read them back. */
class Block {
  readonly chunks: Uint8Array[] = [];
  readonly views: GltfBufferView[] = [];
  readonly accessors: GltfAccessor[] = [];
  private length = 0;

  push(bytes: Uint8Array, accessor: Omit<GltfAccessor, "bufferView">, target: number): number {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) this.chunks.push(new Uint8Array(pad));
    this.length += pad;
    this.views.push({ buffer: 0, byteOffset: this.length, byteLength: bytes.byteLength, target });
    this.chunks.push(bytes);
    this.length += bytes.byteLength;
    this.accessors.push({ ...accessor, bufferView: this.views.length - 1 });
    return this.accessors.length - 1;
  }

  bytes(): Uint8Array {
    const all = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      all.set(chunk, at);
      at += chunk.byteLength;
    }
    return all;
  }
}

const f32 = (values: readonly number[]): Uint8Array => new Uint8Array(new Float32Array(values).buffer);
const u32 = (values: readonly number[]): Uint8Array => new Uint8Array(new Uint32Array(values).buffer);

const COLOURS: Readonly<Record<PanelGroup, readonly number[]>> = { body: [0.86, 0.86, 0.86, 1], sleeve: [0.8, 0.82, 0.86, 1], collar: [0.9, 0.84, 0.8, 1] };

/**
 * A glTF made from a panel layout: an extruded shape for every panel, with UVs that are the layout's rectangles. It is
 * a stand-in so the pipeline can be proved before an artist's model exists; its shapes are flat panels, not a garment.
 */
export function generatePlaceholder(layout: PanelLayout): GltfModel {
  const block = new Block();
  const groups = GROUPS.filter((g) => layout.panels.some((p) => p.group === g));
  const meshes = layout.panels.map((panel) => {
    const m = panelMesh(panel);
    const { min, max } = bounds(m.positions);
    const position = block.push(f32(m.positions), { componentType: 5126, count: m.positions.length / 3, type: "VEC3", min, max }, 34962);
    const texcoord = block.push(f32(m.uvs), { componentType: 5126, count: m.uvs.length / 2, type: "VEC2" }, 34962);
    const indices = block.push(u32(m.indices), { componentType: 5125, count: m.indices.length, type: "SCALAR" }, 34963);
    return { name: panel.id, primitives: [{ attributes: { POSITION: position, TEXCOORD_0: texcoord }, indices, material: groups.indexOf(panel.group) }] };
  });
  const bytes = block.bytes();
  const materials: GltfMaterial[] = groups.map((g) => ({
    name: `material-${g}`,
    pbrMetallicRoughness: { baseColorFactor: COLOURS[g], metallicFactor: 0, roughnessFactor: 0.92 },
    doubleSided: true,
  }));
  return {
    asset: {
      version: "2.0",
      generator: GENERATOR,
      extras: { knitwright: { label: PLACEHOLDER_LABEL, placeholder: true, units: MODEL_UNITS, textureSize: TEXTURE_SIZE, size: layout.size } },
    },
    scene: 0,
    scenes: [{ nodes: layout.panels.map((_, i) => i) }],
    nodes: layout.panels.map((panel, i) => ({ name: panel.id, mesh: i, ...stand(panel.id), extras: { knitwright: { panelId: panel.id, group: panel.group } } })),
    meshes,
    materials,
    accessors: block.accessors,
    bufferViews: block.views,
    buffers: [{ byteLength: bytes.byteLength, uri: `data:application/octet-stream;base64,${toBase64(bytes)}` }],
  };
}
