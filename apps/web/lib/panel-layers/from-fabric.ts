import { parseArtworkStack, type ArtworkStack, type Layer, type ViewId } from "@/lib/artwork-stack";
import { roundMm } from "@/lib/artwork-stack";
import type { FabricDocJson, FabricObjectJson, PanelFrame } from "./fabric-types";
import { clamp01, same, wrapDegrees } from "./geometry";

type MergeResult = { readonly ok: true; readonly stack: ArtworkStack } | { readonly ok: false; readonly reason: string };

const STRANGER_SENTENCE = "Something on the canvas was not made from a layer, so nothing was saved.";

/** The value read from the canvas when it differs from what was drawn, else the layer's own (which may have more digits, or none). */
const edited = <T,>(now: number, drawn: number, made: (value: number) => T, kept: T): T => (same(now, drawn) ? kept : made(now));

function placed(layer: Layer, obj: FabricObjectJson, frame: PanelFrame): Layer {
  const { emitted } = obj.kw;
  const now = { left: obj.left, top: obj.top, width: obj.width * obj.scaleX, height: obj.height * obj.scaleY, angle: obj.angle, fontSize: (obj.fontSize ?? 0) * obj.scaleY };
  if (layer.kind === "graphic") {
    return {
      ...layer,
      offsetMm: {
        x: edited(now.left, emitted.left, (v) => roundMm(v - frame.centre.x), layer.offsetMm.x),
        y: edited(now.top, emitted.top, (v) => roundMm(v - frame.centre.y), layer.offsetMm.y),
      },
      widthMm: edited(now.width, emitted.width, roundMm, layer.widthMm),
      ...heightOf(edited(now.height, emitted.height, roundMm, layer.heightMm)),
      rotationDeg: edited(now.angle, emitted.angle, wrapDegrees, layer.rotationDeg),
    };
  }
  if (layer.kind === "text") {
    return {
      ...layer,
      text: obj.text ?? layer.text,
      offsetMm: {
        x: edited(now.left, emitted.left, (v) => roundMm(v - frame.centre.x), layer.offsetMm.x),
        y: edited(now.top, emitted.top, (v) => roundMm(v - frame.centre.y), layer.offsetMm.y),
      },
      heightMm: edited(now.fontSize, emitted.fontSize, roundMm, layer.heightMm),
      ...widthOf(edited(now.width, emitted.width, roundMm, layer.widthMm)),
      rotationDeg: edited(now.angle, emitted.angle, wrapDegrees, layer.rotationDeg),
    };
  }
  return layer;
}

const heightOf = (heightMm: number | undefined): { heightMm?: number } => (heightMm === undefined ? {} : { heightMm });
const widthOf = (widthMm: number | undefined): { widthMm?: number } => (widthMm === undefined ? {} : { widthMm });

/** One object back to its layer. A fill or a player mark is never moved from the canvas; only its opacity is read. */
function layerOf(obj: FabricObjectJson, frame: PanelFrame): Layer {
  const layer = obj.kw.layer;
  return { ...placed(layer, obj, frame), opacity: clamp01(obj.opacity) };
}

/**
 * Puts the canvas of one view back into the stack. The canvas order is the blend order of that view's layers; layers
 * on other views stay where they were. A layer taken off the canvas is removed, a copy made on it (it keeps its tag)
 * is a new layer. The result is checked by the stack's own rules, so a canvas that makes the stack meaningless is refused.
 */
export function fromFabric(stack: ArtworkStack, view: ViewId, doc: FabricDocJson, frame: PanelFrame): MergeResult {
  if (doc.objects.some((obj) => obj.kw?.layer === undefined || obj.kw.emitted === undefined)) return { ok: false, reason: STRANGER_SENTENCE };
  const updated = doc.objects.map((obj) => layerOf(obj, frame));
  let next = 0;
  const layers = stack.layers.flatMap((layer): Layer[] => {
    if (!layer.views.includes(view)) return [layer];
    return next < updated.length ? [updated[next++] as Layer] : [];
  });
  return parseArtworkStack({ ...stack, layers: [...layers, ...updated.slice(next)] });
}
