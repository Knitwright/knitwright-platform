/** The part of glTF 2.0 this pipeline writes and reads. Every field is as the glTF specification names it. */
export interface GltfAccessor {
  readonly bufferView: number;
  readonly byteOffset?: number;
  /** 5126 float, 5125 unsigned int, 5123 unsigned short, 5121 unsigned byte. */
  readonly componentType: 5126 | 5125 | 5123 | 5121;
  readonly normalized?: boolean;
  readonly count: number;
  readonly type: "SCALAR" | "VEC2" | "VEC3";
  readonly min?: readonly number[];
  readonly max?: readonly number[];
}

export interface GltfBufferView {
  readonly buffer: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly byteStride?: number;
  readonly target?: number;
}

export interface GltfPrimitive {
  readonly attributes: { readonly POSITION: number; readonly TEXCOORD_0: number };
  readonly indices?: number;
  readonly material?: number;
  readonly mode?: number;
}

export interface GltfNode {
  readonly name?: string;
  readonly mesh?: number;
  readonly translation?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number, number];
  readonly scale?: readonly [number, number, number];
  readonly extras?: { readonly knitwright?: { readonly panelId?: string; readonly group?: string } };
}

export interface GltfMaterial {
  readonly name?: string;
  readonly pbrMetallicRoughness?: { readonly baseColorFactor?: readonly number[]; readonly metallicFactor?: number; readonly roughnessFactor?: number };
  readonly doubleSided?: boolean;
}

export interface KnitwrightAssetExtras {
  readonly label: string;
  readonly placeholder: boolean;
  readonly units: string;
  readonly textureSize: number;
  readonly size: string;
}

export interface GltfModel {
  readonly asset: { readonly version: string; readonly generator?: string; readonly extras?: { readonly knitwright: KnitwrightAssetExtras } };
  readonly scene: number;
  readonly scenes: readonly { readonly nodes: readonly number[] }[];
  readonly nodes: readonly GltfNode[];
  readonly meshes: readonly { readonly name?: string; readonly primitives: readonly GltfPrimitive[] }[];
  readonly materials: readonly GltfMaterial[];
  readonly accessors: readonly GltfAccessor[];
  readonly bufferViews: readonly GltfBufferView[];
  readonly buffers: readonly { readonly byteLength: number; readonly uri: string }[];
}
