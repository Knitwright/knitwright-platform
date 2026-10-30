import { LAYERS, type FlatElement, type FlatModel } from "@/lib/flat/model";
import type { FlatViewSection, TechPack } from "../types";
import type { PageDrawing } from "./pages";

/**
 * The drawings the sixteen pages show (decision 0078). Page 2 of the specification is the
 * technical flat with no colour in it, page 3 the same two views in colour, page 7 the views with
 * their callout marks and page 14 one front per colourway.
 *
 * Nothing is drawn that the document did not already hold: these functions only take colour or a
 * layer out of a drawing the tech pack built, so no page can show a shape nobody drafted.
 */

/** Black, for every line of a technical flat. */
const INK = "#000000";
/** White, so a panel reads as an outline rather than a solid block. */
const PAPER = "#ffffff";

/** One element with its colours replaced: lines black, fills white, text black. */
function monoElement(element: FlatElement): FlatElement {
  if (element.kind === "text") return { ...element, colour: INK };
  if (element.kind !== "path") return element;
  return {
    ...element,
    fill: element.fill === null ? null : PAPER,
    stroke: element.stroke === null ? null : { ...element.stroke, colour: INK },
  };
}

/** The drawing with every colour taken out, as a factory's technical flat. The drawing given is not changed. */
export function monochrome(model: FlatModel): FlatModel {
  return { ...model, layers: model.layers.map((layer) => ({ ...layer, elements: layer.elements.map(monoElement) })) };
}

/** The drawing without its callout marks, which live in the measurements layer. */
export function withoutCallouts(model: FlatModel): FlatModel {
  return { ...model, layers: model.layers.filter((layer) => layer.id !== LAYERS.measurements.id) };
}

const mapModel = (view: FlatViewSection, change: (model: FlatModel) => FlatModel): FlatViewSection =>
  view.model === null ? view : { ...view, model: change(view.model) };

/** What a page draws, as view sections ready for the renderer. A page with no drawing gives none. */
export function drawingsFor(drawing: PageDrawing | null, pack: TechPack): readonly FlatViewSection[] {
  switch (drawing) {
    case "flats-mono":
      return pack.flats.views.map((view) => mapModel(view, (model) => monochrome(withoutCallouts(model))));
    case "flats-colour":
      return pack.flats.views.map((view) => mapModel(view, withoutCallouts));
    case "flats-callouts":
      return pack.flats.views;
    case "colourway-fronts":
      return pack.colourways.colourways.map((block) => block.drawing);
    case "illustrations":
    case null:
      return [];
  }
}
