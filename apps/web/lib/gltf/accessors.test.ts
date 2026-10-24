import { describe, expect, it } from "vitest";
import { bufferBytes, readAccessor } from "./accessors";
import { toBase64 } from "./base64";
import type { GltfModel } from "./types";

function modelOf(bytes: Uint8Array, accessor: GltfModel["accessors"][number], view: Partial<GltfModel["bufferViews"][number]> = {}): GltfModel {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [accessor],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bytes.byteLength, ...view }],
    buffers: [{ byteLength: bytes.byteLength, uri: `data:application/octet-stream;base64,${toBase64(bytes)}` }],
  };
}

describe("toBase64", () => {
  it("pads for one and two leftover bytes and matches the standard encoding", () => {
    for (const text of ["", "f", "fo", "foo", "foob", "fooba", "foobar"]) {
      expect(toBase64(new TextEncoder().encode(text))).toBe(btoa(text));
    }
  });
});

describe("readAccessor", () => {
  it("reads unsigned bytes and shorts, plain and normalised", () => {
    const u8 = modelOf(Uint8Array.from([0, 255]), { bufferView: 0, componentType: 5121, normalized: true, count: 2, type: "SCALAR" });
    expect(readAccessor(u8, 0).values).toEqual([0, 1]);
    const u16 = modelOf(new Uint8Array(new Uint16Array([65535, 3]).buffer), { bufferView: 0, componentType: 5123, count: 2, type: "SCALAR" });
    expect(readAccessor(u16, 0).values).toEqual([65535, 3]);
    const u16n = modelOf(new Uint8Array(new Uint16Array([65535]).buffer), { bufferView: 0, componentType: 5123, normalized: true, count: 1, type: "SCALAR" });
    expect(readAccessor(u16n, 0).values).toEqual([1]);
    const raw8 = modelOf(Uint8Array.from([7]), { bufferView: 0, componentType: 5121, count: 1, type: "SCALAR" });
    expect(readAccessor(raw8, 0).values).toEqual([7]);
  });

  it("honours the byte offset and the stride", () => {
    const floats = new Uint8Array(new Float32Array([9, 1, 2, 9, 3, 4]).buffer);
    const model = modelOf(floats, { bufferView: 0, byteOffset: 4, componentType: 5126, count: 2, type: "VEC2" }, { byteStride: 12 });
    expect(readAccessor(model, 0)).toEqual({ values: [1, 2, 3, 4], components: 2 });
  });

  it("reads a buffer the caller supplies", () => {
    const model = { ...modelOf(new Uint8Array(4), { bufferView: 0, componentType: 5125, count: 1, type: "SCALAR" }), buffers: [{ byteLength: 4, uri: "model.bin" }] };
    expect(readAccessor(model, 0, [new Uint8Array(new Uint32Array([42]).buffer)]).values).toEqual([42]);
  });

  it("refuses an accessor that does not exist and a buffer it cannot read", () => {
    const model = modelOf(new Uint8Array(4), { bufferView: 0, componentType: 5125, count: 1, type: "SCALAR" });
    expect(() => readAccessor(model, 3)).toThrow(/accessor 3/);
    expect(() => bufferBytes({ ...model, buffers: [{ byteLength: 1, uri: "x.bin" }] }, 0)).toThrow(/cannot read/);
    expect(() => bufferBytes({ ...model, buffers: [] }, 0)).toThrow(/no address/);
  });
});
