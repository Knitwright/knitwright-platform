import { buildFlat } from "@/lib/flat/build";
import type { ImageMap } from "@/lib/flat/images";
import type { FlatModel, View } from "@/lib/flat/model";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import type { GarmentSpec } from "@/lib/garment";
import { formatDate } from "@/lib/projects/dates";
import { resolveAllSizes, resolveMeasurements, type ChartSet } from "@/lib/sizing";
import { buildColourways } from "@/lib/techpack/colourways";
import { buildComponents } from "@/lib/techpack/components";
import { NO_DRAWING } from "@/lib/techpack/flats";
import type { Cell } from "@/lib/techpack/cell";

/**
 * What a share page shows, and nothing more: the design's name, the brand's name, the front and
 * back drawn by the tech pack's renderer without measurement callouts, and the colours and fabrics.
 * No measurements, construction, labels, components, notes, files or other versions. The page
 * hands every drawing to an image tag as a data address, so nothing in it can run and no stored
 * file is ever linked.
 */

export interface SharePageInput {
  readonly projectName: string;
  readonly brandName: string;
  readonly version: number;
  readonly savedAt: string;
  readonly expiresAt: string;
  readonly spec: GarmentSpec;
  readonly charts?: ChartSet;
  /** The pictures the artwork uses, already read and shrunk. */
  readonly images: ImageMap;
}

export interface SharePicture {
  readonly view: View;
  readonly label: string;
  /** The drawing as a data address, or null when the garment type has no drawing. */
  readonly src: string | null;
  readonly alt: string;
  readonly notice: string | null;
}

interface ShareColour {
  readonly panel: string;
  /** The colour's name or code, or null when none was given. */
  readonly colour: string | null;
  /** The colour drawn on screen, or null. */
  readonly swatch: string | null;
}

export interface ShareColourway {
  readonly id: string;
  readonly name: string;
  readonly colours: readonly ShareColour[];
  readonly picture: SharePicture;
}

export interface ShareFabric {
  readonly name: string;
  readonly composition: string | null;
  readonly panels: readonly string[];
}

export interface SharePageData {
  readonly designName: string;
  readonly brandName: string;
  readonly version: number;
  readonly savedOn: string;
  readonly expiresOn: string;
  readonly flats: readonly SharePicture[];
  readonly colourways: readonly ShareColourway[];
  readonly fabrics: readonly ShareFabric[];
}

const VIEWS: readonly { readonly view: View; readonly label: string }[] = [
  { view: "front", label: "Front" },
  { view: "back", label: "Back" },
];

const valueOf = (cell: Cell): string | null => (cell.status === "set" && cell.value !== "" ? cell.value : null);

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** A screen colour goes into a style on the page, so only a plain hex colour is passed on. */
const swatchOf = (cell: Cell): string | null => {
  const value = valueOf(cell);
  return value && HEX_COLOUR.test(value) ? value : null;
};

const pictureOf = (view: View, label: string, model: FlatModel | null, images: ImageMap): SharePicture =>
  model
    ? { view, label, src: svgDataUri(renderSvg(model, images)), alt: model.description, notice: model.notice }
    : { view, label, src: null, alt: "", notice: NO_DRAWING };

/** The front and back of the first colourway, drawn at the base size with no callouts. */
function flatsOf(input: SharePageInput): SharePicture[] {
  const { spec, charts } = input;
  const measurements = resolveMeasurements(spec, resolveAllSizes(spec, charts).baseSize ?? "", charts);
  const colourwayId = spec.colourways[0].id;
  return VIEWS.map(({ view, label }) =>
    pictureOf(view, label, buildFlat({ spec, measurements, view, colourwayId, callouts: false }), input.images),
  );
}

export function buildSharePage(input: SharePageInput): SharePageData {
  const colourways = buildColourways(input.spec, input.charts).colourways.map((block) => ({
    id: block.id,
    name: block.name,
    colours: block.rows.map((row) => ({ panel: row.label, colour: valueOf(row.code), swatch: swatchOf(row.screenColour) })),
    picture: pictureOf("front", `${block.name}, front`, block.drawing.model, input.images),
  }));
  const fabrics = buildComponents(input.spec).fabrics.map((line) => ({
    name: valueOf(line.name) ?? "Fabric",
    composition: valueOf(line.composition),
    panels: line.panels.map((panel) => panel.label),
  }));
  return {
    designName: input.projectName,
    brandName: input.brandName,
    version: input.version,
    savedOn: formatDate(input.savedAt),
    expiresOn: formatDate(input.expiresAt),
    flats: flatsOf(input),
    colourways,
    fabrics,
  };
}
