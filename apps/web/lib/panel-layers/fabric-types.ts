import type { Layer } from "@/lib/artwork-stack";

/**
 * The part of Fabric.js v7's JSON this mapping reads and writes. Plain data, so the mapping is pure and
 * never imports the library (which needs a browser). One Fabric unit is one millimetre on the panel.
 */
export interface FabricObjectJson {
  readonly type: "Rect" | "Textbox";
  readonly originX: "center";
  readonly originY: "center";
  /** The object's centre: the panel centre plus the layer's offset. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly angle: number;
  readonly opacity: number;
  readonly globalCompositeOperation: string;
  readonly fill: string;
  readonly stroke?: string | null;
  readonly strokeDashArray?: readonly number[] | null;
  readonly text?: string;
  readonly fontSize?: number;
  readonly selectable: boolean;
  readonly evented: boolean;
  /** Our own property. Fabric keeps it when asked for it by name (`toObject(["kw"])`). */
  readonly kw: KwTag;
}

/** What travels with an object so nothing is lost: the whole layer as it was, and the size the mapping gave the object. */
export interface KwTag {
  readonly layer: Layer;
  /**
   * The geometry the mapping gave the object. A value read back that still equals this is not an edit, so the layer's
   * own value (which may have more digits, or be absent) is kept exactly.
   */
  readonly emitted: Geometry;
}

export interface Geometry {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
  readonly fontSize: number;
}

export interface FabricDocJson {
  readonly version: string;
  readonly objects: readonly FabricObjectJson[];
}

export interface PanelFrame {
  /** The panel's centre in its own millimetres. Offsets are measured from here (see decision 0053). */
  readonly centre: { readonly x: number; readonly y: number };
  /** The panel's width and height, which a fill is drawn to. */
  readonly size: { readonly w: number; readonly h: number };
}
