import { buildFlat } from "@/lib/flat/build";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import { tableSize } from "@/lib/projects/measurement-table";
import { resolveMeasurements } from "@/lib/sizing";
import { specFromSnapshot } from "./copy";

export interface TemplatePreview {
  /** The front of the design as a data address for an image tag, so nothing in it can run. */
  readonly src: string;
  readonly alt: string;
}

/** The front of a template's design, drawn the same way as the editor's drawing. Null when the design cannot be drawn. */
export function previewOf(snapshot: unknown): TemplatePreview | null {
  const copy = specFromSnapshot(snapshot);
  if (!copy.ok) return null;
  const { spec } = copy;
  const measurements = resolveMeasurements(spec, tableSize(spec));
  const model = buildFlat({ spec, measurements, view: "front", colourwayId: spec.colourways[0].id });
  if (!model) return null;
  return { src: svgDataUri(renderSvg(model)), alt: model.description };
}
