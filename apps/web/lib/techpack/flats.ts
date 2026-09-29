import { buildFlat } from "@/lib/flat/build";
import { LAYERS, type FlatElement, type FlatLayer, type FlatModel, type View } from "@/lib/flat/model";
import { formatCm, type GarmentSpec } from "@/lib/garment";
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

const baseMeasurements = (spec: GarmentSpec, charts?: ChartSet) =>
  resolveMeasurements(spec, resolveAllSizes(spec, charts).baseSize ?? "", charts);

/**
 * The front and back drawings for a tech pack, with callouts, drawn from the same
 * measurements the table shows for the base size. The colourway asked for is drawn, and the
 * first when none is asked for or the one asked for is not in the design. A drawing that is
 * not to scale never gets callouts. A type with no drawing gives null.
 */
export function flatsForTechPack(
  spec: GarmentSpec,
  charts?: ChartSet,
  colourwayId?: string,
): Readonly<Record<View, FlatModel | null>> {
  const measurements = baseMeasurements(spec, charts);
  const colourway = spec.colourways.find((entry) => entry.id === colourwayId) ?? spec.colourways[0];
  const draw = (view: View) => buildFlat({ spec, measurements, view, colourwayId: colourway.id, callouts: true });
  return { front: draw("front"), back: draw("back") };
}

/** The value drawn for each point of measure, in tenths of a millimetre, for the base size. */
export function calloutValues(spec: GarmentSpec, charts?: ChartSet): ReadonlyMap<string, number> {
  return new Map(baseMeasurements(spec, charts).rows.flatMap((row) => (row.status === "set" ? [[row.pointId, row.value] as const] : [])));
}

/** The words of a callout on the drawing, which are the label of its point and its value. */
const calloutText = (label: string, value: number): string => `${label} ${formatCm(value)} cm`;

function recoded(element: FlatElement, codes: readonly CalloutCode[], values: ReadonlyMap<string, number>): FlatElement {
  if (element.kind === "text") {
    const found = codes.find((entry) => {
      const value = values.get(entry.pointId);
      return value !== undefined && element.text === calloutText(entry.label, value);
    });
    const value = found ? values.get(found.pointId) : undefined;
    return found && value !== undefined ? { ...element, text: `${found.code} ${formatCm(value)} cm` } : element;
  }
  if (element.kind === "path") {
    const found = codes.find((entry) => element.name === `${entry.label} line`);
    return found ? { ...element, name: `${found.code} line` } : element;
  }
  return element;
}

/**
 * The drawing with each callout label replaced by the short code of its point, so it reads with
 * the table. A callout is matched to its point by the label and the value that was drawn for it,
 * as a whole, and never by the start of the words. The drawing it is given is not changed.
 */
export function withCalloutCodes(
  model: FlatModel,
  codes: readonly CalloutCode[],
  values: ReadonlyMap<string, number>,
): FlatModel {
  const layers: readonly FlatLayer[] = model.layers.map((layer) =>
    layer.id === LAYERS.measurements.id ? { ...layer, elements: layer.elements.map((element) => recoded(element, codes, values)) } : layer,
  );
  return { ...model, layers };
}

const withoutCallouts = (model: FlatModel): FlatModel => ({
  ...model,
  layers: model.layers.filter((layer) => layer.id !== LAYERS.measurements.id),
});

function viewOf(
  entry: (typeof VIEWS)[number],
  model: FlatModel | null,
  codes: readonly CalloutCode[],
  values: ReadonlyMap<string, number>,
): FlatViewSection {
  const { view, label } = entry;
  if (!model) return { view, label, model: null, toScale: false, notice: NO_DRAWING, description: "" };
  const shown = model.toScale ? withCalloutCodes(model, codes, values) : withoutCallouts(model);
  return { view, label, model: shown, toScale: model.toScale, notice: model.notice, description: model.description };
}

function noteFor(views: readonly FlatViewSection[]): string | null {
  if (views.every((view) => view.model === null)) return NO_DRAWING;
  const unscaled = views.find((view) => view.model !== null && !view.toScale);
  if (!unscaled) return null;
  return `${unscaled.notice ?? "Not to scale."} ${NO_VALUES}`;
}

/** The flats section: both views, the callouts only when the drawing is to scale, and a legend of the codes. */
export function buildFlatsSection(
  spec: GarmentSpec,
  flats: Readonly<Record<View, FlatModel | null>>,
  charts?: ChartSet,
): FlatsSection {
  const codes = calloutCodes(spec);
  const values = calloutValues(spec, charts);
  const views = VIEWS.map((entry) => viewOf(entry, flats[entry.view], codes, values));
  const anyScaled = views.some((view) => view.toScale);
  const callouts: readonly CalloutKey[] = anyScaled ? codes : [];
  return { id: "flats", title: SECTION_TITLES.flats, note: noteFor(views), views, callouts };
}
