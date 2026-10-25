import type { ArtworkStack, TextLayer, ViewId } from "@/lib/artwork-stack";

/** The height a new text layer starts at, in millimetres. A starting size the person changes, not a measurement. */
export const NEW_TEXT_HEIGHT_MM = 30;

const freeId = (stack: ArtworkStack): string => {
  const taken = new Set(stack.layers.map((layer) => layer.id));
  let n = 1;
  while (taken.has(`text-${n}`)) n += 1;
  return `text-${n}`;
};

/** A copy of the stack with a text layer on top of one view. */
export function addTextLayer(stack: ArtworkStack, view: ViewId, text: string): ArtworkStack {
  const layer: TextLayer = {
    id: freeId(stack),
    kind: "text",
    views: [view],
    opacity: 1,
    blend: "normal",
    provenance: "user-edited",
    text,
    placement: { kind: "anchor", anchorId: "centre-chest" },
    offsetMm: { x: 0, y: 0 },
    heightMm: NEW_TEXT_HEIGHT_MM,
    rotationDeg: 0,
  };
  return { ...stack, layers: [...stack.layers, layer] };
}

/** A copy of the stack without this layer. */
export const removeLayer = (stack: ArtworkStack, layerId: string): ArtworkStack => ({
  ...stack,
  layers: stack.layers.filter((layer) => layer.id !== layerId),
});

/** A copy of the stack with a layer swapped with its neighbour on one view. The same stack when it cannot move. */
export function moveLayer(stack: ArtworkStack, view: ViewId, layerId: string, direction: "up" | "down"): ArtworkStack {
  const onView = stack.layers.flatMap((layer, at) => (layer.views.includes(view) ? [at] : []));
  const slot = onView.findIndex((at) => stack.layers[at]?.id === layerId);
  const other = slot + (direction === "up" ? 1 : -1);
  if (slot < 0 || other < 0 || other >= onView.length) return stack;
  const [a, b] = [onView[slot] as number, onView[other] as number];
  const layers = stack.layers.map((layer, at) => (at === a ? stack.layers[b] : at === b ? stack.layers[a] : layer)) as ArtworkStack["layers"];
  return { ...stack, layers };
}
