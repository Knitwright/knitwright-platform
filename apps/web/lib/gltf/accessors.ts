import type { GltfModel } from "./types";

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3 } as const;
const BYTES = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 } as const;
const DATA_URI = /^data:[^,]*;base64,/;

export interface AccessorData {
  readonly values: readonly number[];
  readonly components: number;
}

/** The bytes of one buffer: from `buffers` when the caller holds them (a .glb or an external file), else from a data address. */
export function bufferBytes(model: GltfModel, index: number, buffers?: readonly Uint8Array[]): Uint8Array {
  const given = buffers?.[index];
  if (given) return given;
  const uri = model.buffers[index]?.uri ?? "";
  if (!DATA_URI.test(uri)) throw new Error(`The buffer ${index} (${uri || "no address"}) cannot read: pass its bytes.`);
  const text = atob(uri.slice(uri.indexOf(",") + 1));
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

function readOne(view: DataView, at: number, type: number, normalized: boolean): number {
  switch (type) {
    case 5126:
      return view.getFloat32(at, true);
    case 5125:
      return view.getUint32(at, true);
    case 5123:
      return normalized ? view.getUint16(at, true) / 65535 : view.getUint16(at, true);
    default:
      return normalized ? view.getUint8(at) / 255 : view.getUint8(at);
  }
}

/** The numbers of one accessor, flat, honouring offset and stride. */
export function readAccessor(model: GltfModel, index: number, buffers?: readonly Uint8Array[]): AccessorData {
  const accessor = model.accessors[index];
  const view = accessor ? model.bufferViews[accessor.bufferView] : undefined;
  if (!accessor || !view) throw new Error(`The accessor ${index} does not exist.`);
  const bytes = bufferBytes(model, view.buffer, buffers);
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const components = COMPONENTS[accessor.type];
  const size = BYTES[accessor.componentType];
  const stride = view.byteStride ?? components * size;
  const start = view.byteOffset + (accessor.byteOffset ?? 0);
  const values: number[] = [];
  for (let i = 0; i < accessor.count; i += 1) {
    for (let c = 0; c < components; c += 1) values.push(readOne(data, start + i * stride + c * size, accessor.componentType, accessor.normalized === true));
  }
  return { values, components };
}
