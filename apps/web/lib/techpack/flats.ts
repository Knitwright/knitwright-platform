import { buildFlat } from "@/lib/flat/build";
import { LAYERS, type FlatElement, type FlatLayer, type FlatModel, type View } from "@/lib/flat/model";
import type { GarmentSpec } from "@/lib/garment";
import { resolveAllSizes, resolveMeasurements, type ChartSet } from "@/lib/sizing";
import { calloutCodes, type CalloutCode } from "./codes";
import type { CalloutKey, FlatsSection, FlatViewSection } from "./types";
import { SECTION_TITLES } from "./types";

const VIEWS: readonly { readonly view: View; readonly label: string }[] = [
  { view: "front", label: "Front" },
  { view: "back", label: "Back" },
];

export const NO_DRAWING = "There is no drawing for this garment type yet.";
const NO_VALUES = "The drawing carries no measurement values.";

/**
 * The front and back drawings for a tech pack, with callouts, drawn from the same
 * measurements the table shows for the base size. The first colourway is drawn. A drawing
 * that is not to scale never gets callouts. A type with no drawing gives null.
 */
export function flatsForTechPack(spec: GarmentSpec, charts?: ChartSet): Readonly<Record<View, FlatModel | null>> {
  const measurements = resolveMeasurements(spec, resolveAllSizes(spec, charts).baseSize ?? "", charts);
  const colourwayId = spec.colourways[0].id;
  const draw = (view: View) => buildFlat({ spec, measurements, view, colourwayId, callouts: true });
  return { front: draw("front"), back: draw("back") };
}

const codeForLabel = (codes: readonly CalloutCode[], text: string): CalloutCode | undefined =>
  codes.find((entry) => text.startsWith(`${entry.label} `));

function recoded(element: FlatElement, codes: readonly CalloutCode[]): FlatElement {
  if (element.kind === "text") {
    const found = codeForLabel(codes, element.text);
    return found ? { ...element, text: `${found.code} ${element.text.slice(found.label.length + 1)}` } : element;
  }
  if (element.kind === "path" && element.name.endsWith(" line")) {
    const found = codeForLabel(codes, element.name);
    return found ? { ...element, name: `${found.code} line` } : element;
  }
  return element;
}

/**
 * The drawing with each callout label replaced by its short code, so it reads with the
 * table. The values stay. The drawing it is given is not changed.
 */
export function withCalloutCodes(model: FlatModel, codes: readonly CalloutCode[]): FlatModel {
  const layers: readonly FlatLayer[] = model.layers.map((layer) =>
    layer.id === LAYERS.measurements.id ? { ...layer, elements: layer.elements.map((element) => recoded(element, codes)) } : layer,
  );
  return { ...model, layers };
}

const withoutCallouts = (model: FlatModel): FlatModel => ({
  ...model,
  layers: model.layers.filter((layer) => layer.id !== LAYERS.measurements.id),
});

function viewOf(entry: (typeof VIEWS)[number], model: FlatModel | null, codes: readonly CalloutCode[]): FlatViewSection {
  const { view, label } = entry;
  if (!model) return { view, label, model: null, toScale: false, notice: NO_DRAWING, description: "" };
  const shown = model.toScale ? withCalloutCodes(model, codes) : withoutCallouts(model);
  return { view, label, model: shown, toScale: model.toScale, notice: model.notice, description: model.description };
}

function noteFor(views: readonly FlatViewSection[]): string | null {
  if (views.every((view) => view.model === null)) return NO_DRAWING;
  const unscaled = views.find((view) => view.model !== null && !view.toScale);
  if (!unscaled) return null;
  return `${unscaled.notice ?? "Not to scale."} ${NO_VALUES}`;
}

/** The flats section: both views, the callouts only when the drawing is to scale, and a legend of the codes. */
export function buildFlatsSection(spec: GarmentSpec, flats: Readonly<Record<View, FlatModel | null>>): FlatsSection {
  const codes = calloutCodes(spec);
  const views = VIEWS.map((entry) => viewOf(entry, flats[entry.view], codes));
  const anyScaled = views.some((view) => view.toScale);
  const callouts: readonly CalloutKey[] = anyScaled ? codes : [];
  return { id: "flats", title: SECTION_TITLES.flats, note: noteFor(views), views, callouts };
}
