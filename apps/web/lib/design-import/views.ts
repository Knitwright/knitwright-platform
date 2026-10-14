import type { ViewId } from "@/lib/artwork-stack";
import type { Box } from "./geometry";
import type { PictureReading } from "./read";

/** A region of the picture that holds one view. Boxes are in pixels. */
export interface NamedView {
  readonly view: ViewId;
  readonly box: Box;
  readonly confidence: number;
}

const centre = (box: Box): { x: number; y: number } => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
const toPixels = (box: Box, size: { width: number; height: number }): Box => ({ x: box.x * size.width, y: box.y * size.height, w: box.w * size.width, h: box.h * size.height });

/**
 * Names the regions found in a picture (plan W7d step 3). The model says which views are in the picture and
 * roughly where; the regions come from the pixels. Each region takes the name of the nearest view the model
 * listed. With no names, one region is assumed to be the front and two to be the front and the back.
 */
export function nameViews(
  size: { readonly width: number; readonly height: number },
  regions: readonly Box[],
  reading: PictureReading,
): { readonly views: readonly NamedView[]; readonly note: string } {
  if (regions.length === 0) return { views: [], note: "" };
  const listed = reading.views.filter((entry, at) => reading.views.findIndex((other) => other.view === entry.view) === at);
  if (listed.length === 0) {
    const order: ViewId[] = ["front", "back"];
    const views = regions.slice(0, 2).map((box, at): NamedView => ({ view: order[at], box, confidence: 0.4 }));
    const dropped = regions.length > 2 ? " Other items in the picture were not used." : "";
    return { views, note: `The model did not say which views the picture shows, so ${views.length === 1 ? "the front was" : "the front and the back were"} assumed, left to right.${dropped}` };
  }
  if (regions.length < listed.length) {
    const views = listed.map((entry): NamedView => ({ view: entry.view, box: toPixels(entry.box, size), confidence: 0.5 }));
    return { views, note: "The views touch each other in the picture, so the regions the model gave were used." };
  }
  const free = regions.map((box, at) => ({ box, at }));
  const named: NamedView[] = [];
  const pairs = listed
    .flatMap((entry) => free.map((region) => ({ entry, region, distance: Math.hypot(centre(toPixels(entry.box, size)).x - centre(region.box).x, centre(toPixels(entry.box, size)).y - centre(region.box).y) })))
    .sort((a, b) => a.distance - b.distance);
  const takenViews = new Set<ViewId>();
  const takenRegions = new Set<number>();
  for (const pair of pairs) {
    if (takenViews.has(pair.entry.view) || takenRegions.has(pair.region.at)) continue;
    takenViews.add(pair.entry.view);
    takenRegions.add(pair.region.at);
    named.push({ view: pair.entry.view, box: pair.region.box, confidence: 0.8 });
  }
  const unused = regions.length - named.length;
  return { views: named.sort((a, b) => a.box.x - b.box.x), note: unused > 0 ? "Other items in the picture were not used." : "" };
}
