import { resolveColour, type ArtworkStack, type Blend, type Layer, type ViewId } from "@/lib/artwork-stack";
import type { FabricDocJson, FabricObjectJson, Geometry, PanelFrame } from "./fabric-types";

/** The Fabric version this mapping was written against. */
const FABRIC_VERSION = "7.4.0";

/** Fabric's names for our blends. Knock-out removes what is under it. */
const COMPOSITE: Readonly<Record<Blend, string>> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  "knock-out": "destination-out",
};

const PLACEHOLDER = "#d9d9d9";
const INK = "#111111";
/** An average letter is about this wide as a share of the text height. Only used to give a text layer with no width a box. */
const LETTER_WIDTH = 0.6;

const screenOf = (stack: ArtworkStack, colourId: string | undefined): string | undefined =>
  colourId === undefined ? undefined : resolveColour(stack, stack.colourways[0]?.id, colourId)?.screen;

const base = (layer: Layer, geometry: Geometry, extra: Partial<FabricObjectJson> & Pick<FabricObjectJson, "type" | "fill" | "selectable">): FabricObjectJson => ({
  originX: "center",
  originY: "center",
  left: geometry.left,
  top: geometry.top,
  width: geometry.width,
  height: geometry.height,
  scaleX: 1,
  scaleY: 1,
  angle: geometry.angle,
  opacity: layer.opacity,
  globalCompositeOperation: COMPOSITE[layer.blend],
  evented: extra.selectable,
  kw: { layer, emitted: geometry },
  ...extra,
});

function fillObject(stack: ArtworkStack, layer: Layer, frame: PanelFrame): FabricObjectJson {
  const colourId = layer.kind === "ground" ? layer.colourId : layer.kind === "pattern" ? layer.colourIds[0] : undefined;
  const geometry: Geometry = { left: frame.centre.x, top: frame.centre.y, width: frame.size.w, height: frame.size.h, angle: 0, fontSize: 0 };
  // A pattern and a picture fill are drawn as one flat colour here: the generators and the pictures are not drawn on the canvas (decision 0053).
  return base(layer, geometry, { type: "Rect", fill: screenOf(stack, colourId) ?? PLACEHOLDER, selectable: false });
}

function graphicObject(stack: ArtworkStack, layer: Extract<Layer, { kind: "graphic" }>, frame: PanelFrame): FabricObjectJson {
  const geometry: Geometry = {
    left: frame.centre.x + layer.offsetMm.x,
    top: frame.centre.y + layer.offsetMm.y,
    width: layer.widthMm,
    height: layer.heightMm ?? layer.widthMm,
    angle: layer.rotationDeg,
    fontSize: 0,
  };
  return base(layer, geometry, { type: "Rect", fill: PLACEHOLDER, stroke: "#555555", strokeDashArray: [6, 4], selectable: true });
}

function textObject(stack: ArtworkStack, layer: Extract<Layer, { kind: "text" }>, frame: PanelFrame): FabricObjectJson {
  const geometry: Geometry = {
    left: frame.centre.x + layer.offsetMm.x,
    top: frame.centre.y + layer.offsetMm.y,
    width: layer.widthMm ?? layer.heightMm * LETTER_WIDTH * layer.text.length,
    height: layer.heightMm,
    angle: layer.rotationDeg,
    fontSize: layer.heightMm,
  };
  return base(layer, geometry, { type: "Textbox", fill: screenOf(stack, layer.colourId) ?? INK, text: layer.text, fontSize: geometry.fontSize, selectable: true });
}

function markObject(stack: ArtworkStack, layer: Extract<Layer, { kind: "player-mark" }>, frame: PanelFrame): FabricObjectJson {
  // Where a name or number goes depends on the piece mapper (decision 0035), which is not built. It is drawn at the centre, locked.
  const height = layer.heightMm ?? 60;
  const text = `${layer.sample?.name ?? "NAME"} ${layer.sample?.number ?? "00"}`;
  const geometry: Geometry = { left: frame.centre.x, top: frame.centre.y, width: height * LETTER_WIDTH * text.length, height, angle: 0, fontSize: height };
  return base(layer, geometry, { type: "Textbox", fill: screenOf(stack, layer.colourId) ?? INK, text, fontSize: height, selectable: false });
}

function objectOf(stack: ArtworkStack, layer: Layer, frame: PanelFrame): FabricObjectJson {
  switch (layer.kind) {
    case "graphic":
      return graphicObject(stack, layer, frame);
    case "text":
      return textObject(stack, layer, frame);
    case "player-mark":
      return markObject(stack, layer, frame);
    default:
      return fillObject(stack, layer, frame);
  }
}

/** The layers of one view as Fabric JSON, bottom first. Pure: the same stack gives the same JSON. */
export function toFabric(stack: ArtworkStack, view: ViewId, frame: PanelFrame): FabricDocJson {
  return { version: FABRIC_VERSION, objects: stack.layers.filter((layer) => layer.views.includes(view)).map((layer) => objectOf(stack, layer, frame)) };
}
