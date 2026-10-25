import type { FlatElement, FlatModel } from "@/lib/flat/model";

/** A rectangle of the picture, in pixels. */
export type Region = Readonly<{ x: number; y: number; width: number; height: number; label: string }>;

/** Roughly how wide a character is, as a share of the type size. Only used to size a box around text. */
const CHARACTER_WIDTH = 0.65;

const boxOf = (element: FlatElement): { cx: number; cy: number; w: number; h: number; label: string } | null => {
  if (element.kind === "image") {
    // A turned picture is covered by the circle through its corners.
    const half = Math.hypot(element.width, element.height) / 2;
    const turned = element.rotation % 180 !== 0;
    return { cx: element.at.x, cy: element.at.y, w: turned ? half * 2 : element.width, h: turned ? half * 2 : element.height, label: "logo" };
  }
  if (element.kind === "text") {
    const w = element.text.length * element.size * CHARACTER_WIDTH;
    const cx = element.anchor === "middle" ? element.at.x : element.anchor === "start" ? element.at.x + w / 2 : element.at.x - w / 2;
    return { cx, cy: element.at.y, w, h: element.size * 1.2, label: "text" };
  }
  return null;
};

/**
 * The places on a render where the club's own marks are: pictures (crest, sponsors) and the lettering of names and numbers.
 * They come from the artwork layer and the details of the design's own drawing, placed on the picture the way
 * `renderReference` places the drawing: fitted to a square of `edge` pixels, centred.
 */
export function protectedRegions(model: FlatModel, edge: number): readonly Region[] {
  const { minX, minY, maxX, maxY } = model.bounds;
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(edge / width, edge / height);
  const left = (edge - width * scale) / 2;
  const top = (edge - height * scale) / 2;
  const regions: Region[] = [];
  for (const layer of model.layers) {
    if (layer.id !== "artwork" && layer.id !== "details") continue;
    for (const element of layer.elements) {
      if (layer.id === "details" && element.kind !== "text") continue;
      const box = boxOf(element);
      if (!box) continue;
      const x = Math.max(0, Math.floor(left + (box.cx - box.w / 2 - minX) * scale));
      const y = Math.max(0, Math.floor(top + (box.cy - box.h / 2 - minY) * scale));
      const right = Math.min(edge, Math.ceil(left + (box.cx + box.w / 2 - minX) * scale));
      const bottom = Math.min(edge, Math.ceil(top + (box.cy + box.h / 2 - minY) * scale));
      if (right > x && bottom > y) regions.push({ x, y, width: right - x, height: bottom - y, label: box.label });
    }
  }
  return regions;
}
