import { buildFlat } from "@/lib/flat/build";
import type { ImageMap } from "@/lib/flat/images";
import type { FlatModel, View } from "@/lib/flat/model";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import type { GarmentSpec } from "@/lib/garment";
import { resolveMeasurements, type ChartSet } from "@/lib/sizing";
import { tableSize } from "./measurement-table";

export interface FlatPreviewView {
  readonly view: View;
  readonly label: string;
  /** A data address for an image tag. The drawing is shown as a picture, so nothing in it can run. */
  readonly src: string;
  /** The drawing in words. */
  readonly alt: string;
}

export interface FlatPreviewData {
  readonly views: readonly FlatPreviewView[];
  readonly toScale: boolean;
  /** "Not to scale. Some measurements are missing." or null. */
  readonly notice: string | null;
  /** A plain sentence saying what to add, or null. */
  readonly missingSentence: string | null;
}

const VIEWS: readonly { view: View; label: string }[] = [
  { view: "front", label: "Front" },
  { view: "back", label: "Back" },
];

const NAMED_AT_MOST = 3;

/** "To draw this to scale, add these measurements: A, B and 2 more." */
export function missingSentence(labels: readonly string[]): string | null {
  if (labels.length === 0) return null;
  if (labels.length === 1) return `To draw this to scale, add this measurement: ${labels[0]}.`;
  const named = labels.length > NAMED_AT_MOST + 1 ? labels.slice(0, NAMED_AT_MOST) : labels;
  const rest = labels.length - named.length;
  const last = rest > 0 ? `${rest} more` : named[named.length - 1];
  const head = rest > 0 ? named : named.slice(0, -1);
  const joined = head.length > 0 ? `${head.join(", ")} and ${last}` : String(last);
  return `To draw this to scale, add these measurements: ${joined}.`;
}

/**
 * Both sides of the design, drawn on the server from the design as it is held there. The
 * measurements are the ones the table shows, for the same size. The result is plain
 * strings for the screen to hand to an image tag. Null for a type there is no drawing for.
 */
export function flatPreview(spec: GarmentSpec, images: ImageMap, charts?: ChartSet): FlatPreviewData | null {
  const measurements = resolveMeasurements(spec, tableSize(spec, charts), charts);
  const colourwayId = spec.colourways[0].id;
  const models: { label: string; model: FlatModel }[] = [];
  for (const { view, label } of VIEWS) {
    const model = buildFlat({ spec, measurements, view, colourwayId });
    if (!model) return null;
    models.push({ label, model });
  }
  const first = models[0]?.model;
  if (!first) return null;
  return {
    views: models.map(({ label, model }) => ({
      view: model.view,
      label,
      src: svgDataUri(renderSvg(model, images)),
      alt: model.description,
    })),
    toScale: first.toScale,
    notice: first.notice,
    missingSentence: missingSentence(first.missing.map((point) => point.label)),
  };
}
