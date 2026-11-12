import { buildFlat } from "@/lib/flat/build";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import { tableSize } from "@/lib/projects/measurement-table";
import { startingSpec } from "@/lib/projects/starting-spec";
import { resolveMeasurements } from "@/lib/sizing";

/**
 * The render on a product card and in the gallery: the front of the article's garment type as a new design starts
 * it, drawn by the same renderer as the editor's flat. No sample of any base has been photographed, so this is the
 * truest picture there is; the page labels it a render, not a photo. An article with no garment type yet (fight
 * shorts) has no render, and the card shows the plain outline instead.
 */

export interface Render {
  /** A data address for an image tag, so nothing in it can run. */
  readonly src: string;
  readonly alt: string;
}

const cache = new Map<string, Render | null>();

const draw = (typeId: string): Render | null => {
  const started = startingSpec(typeId, "men");
  if (!started.ok) return null;
  const { spec } = started;
  const model = buildFlat({ spec, measurements: resolveMeasurements(spec, tableSize(spec)), view: "front", colourwayId: spec.colourways[0].id });
  return model ? { src: svgDataUri(renderSvg(model)), alt: model.description } : null;
};

/** The render of a garment type, worked out once per type: the drawing depends on nothing else. */
export function renderOf(typeId: string | null): Render | null {
  if (typeId === null) return null;
  if (!cache.has(typeId)) cache.set(typeId, draw(typeId));
  return cache.get(typeId) ?? null;
}
