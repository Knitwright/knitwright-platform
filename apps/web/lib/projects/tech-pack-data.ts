import type { ImageMap } from "@/lib/flat/images";
import type { GarmentSpec } from "@/lib/garment";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import type { ChartSet } from "@/lib/sizing";
import {
  buildTechPack,
  completenessReport,
  confirmSentence,
  flatsForTechPack,
  type CompletenessReport,
  type RevisionInput,
  type TechPack,
} from "@/lib/techpack";
import type { ProductionInput } from "@/lib/techpack/production/input";
import { formatDate, isoDay } from "./dates";
import { madeBy, type MemberNames } from "./member-names";
import type { OpenProject, VersionsPage } from "./service";
import { groupVersions, revisionNote } from "./version-groups";
import {
  componentRows,
  fabricRows,
  labellingRows,
  panelFabricRows,
  seamRows,
  type ComponentRow,
  type FabricFormRow,
  type LabellingFormRow,
  type PanelFabricRow,
  type SeamRow,
} from "./tech-pack-forms";
import { sizesText } from "./sizing-form";
import { confirmables, type Confirmable } from "./tech-pack-confirm";
import { colourwayFormRows, measurementFormRows, type ColourwayFormRow, type MeasurementFormRow } from "./tech-pack-value-forms";

export interface FlatPicture {
  readonly view: "front" | "back";
  readonly label: string;
  /** The drawing as a picture address, or null when the garment type has no drawing. */
  readonly src: string | null;
  /** The drawing in words. */
  readonly alt: string;
  readonly toScale: boolean;
  readonly notice: string | null;
}

/** The front drawn in one colourway, for the colourways section of the page. */
export interface ColourwayPicture extends FlatPicture {
  readonly colourwayId: string;
}

/** The drawings of the page as pictures. They wait for the artwork's pictures to be read. */
export interface TechPackPictures {
  readonly flats: readonly FlatPicture[];
  /** One drawing for each colourway, in the order of the colourways. */
  readonly colourwayFlats: readonly ColourwayPicture[];
  /** One sentence saying some pictures are not shown, or null. */
  readonly picturesNote: string | null;
}

/** Everything the page shows but the pictures. It needs no stored picture, so it is ready first. */
export interface TechPackCoreData {
  readonly projectId: string;
  readonly name: string;
  readonly version: number;
  readonly pack: TechPack;
  readonly report: CompletenessReport;
  /** "12 things to confirm." */
  readonly sentence: string;
  /** Says the design changed while the page was loading, or null. */
  readonly staleNote: string | null;
  readonly forms: Readonly<{
    cover: CoverFormData;
    measurements: readonly MeasurementFormRow[];
    fabrics: readonly FabricFormRow[];
    panels: readonly PanelFabricRow[];
    components: readonly ComponentRow[];
    seams: readonly SeamRow[];
    colourways: readonly ColourwayFormRow[];
    labelling: readonly LabellingFormRow[];
  }>;
  /** Everything suggested or proposed and not yet confirmed, each with what confirms it. */
  readonly confirmables: readonly Confirmable[];
  /** The design the page was made from. The forms work out changes from it and the changes waiting. */
  readonly spec: GarmentSpec;
}

type TechPackPageData = TechPackCoreData & TechPackPictures;

/** What the cover's forms hold: the design's details, and its sizes. */
export interface CoverFormData {
  readonly name: string;
  readonly styleNumber: string;
  readonly season: string;
  /** The sizes as typed in the editor, such as "S, M, L". Empty when the design has none of its own. */
  readonly sizesText: string;
  readonly baseSize: string;
  readonly sizesSet: boolean;
}

export interface TechPackPageInput {
  readonly project: OpenProject;
  readonly history: VersionsPage;
  readonly brandName: string;
  /** The pictures the design's artwork uses. */
  readonly images: ImageMap;
  /** The moment the page is made. The document prints its day. It is passed in, so the library never reads a clock. */
  readonly now: Date;
  readonly charts?: ChartSet;
  readonly picturesNote?: string | null;
  /** The colourway to draw, from the address. The first is drawn when it is missing or unknown. */
  readonly colourwayId?: string;
  /** The names of the brand's members, for "Made by". Anyone else is "Not recorded". */
  readonly memberNames?: MemberNames;
  /** What the production services know: pictures, print profile, release, strike-off and the reading a design came from. */
  readonly production?: ProductionInput;
}

/** What the document is made from. The artwork's pictures are not: only the drawings show them. */
export type PackInput = Omit<TechPackPageInput, "images" | "picturesNote">;

export const STALE_SENTENCE = "This design was changed while the page was loading. Reload the page to see the latest version.";

/** True when a saved version is newer than the design that was read. The page then reads again. */
export const historyIsNewer = (project: OpenProject, history: VersionsPage): boolean =>
  history.versions.some((entry) => entry.version > project.currentVersion);

/**
 * Only versions up to the design that was read are listed, so the document never mixes two versions.
 * A run of quick edits by one person is one revision, listed under its newest version.
 */
const revisionsOf = (history: VersionsPage, current: number, names: MemberNames): readonly RevisionInput[] =>
  groupVersions(history.versions.filter((entry) => entry.version <= current)).map((group) => ({
    version: group.newest.version,
    date: formatDate(group.newest.createdAt),
    dateIso: isoDay(group.newest.createdAt),
    note: revisionNote(group),
    by: madeBy(group.newest.createdBy ?? null, names),
  }));

const NO_NAMES: MemberNames = new Map();

/** Front and back left undrawn, for a count that never shows them. */
const UNDRAWN: ReturnType<typeof flatsForTechPack> = { front: null, back: null };

interface PackOptions {
  /**
   * False leaves the front and back flats undrawn. Nothing that is counted or confirmed is read
   * from a drawing, so the studio home counts empty fields without drawing them. True by default.
   */
  readonly drawFlats?: boolean;
}

/**
 * The document for one version of a design. The screen and every export are made by this one
 * function from the same inputs, so they cannot disagree: the drawings, the table and the
 * document all come from the one version that was read.
 */
export function buildPackFor(input: PackInput, options: PackOptions = {}): TechPack {
  const { project, history, charts } = input;
  const flats = options.drawFlats === false ? UNDRAWN : flatsForTechPack(project.spec, charts, input.colourwayId);
  return buildTechPack({
    project: { name: project.name, styleNumber: project.styleNumber, season: project.season, brandName: input.brandName },
    version: project.currentVersion,
    versionDate: formatDate(project.versionSavedAt),
    versionDateIso: isoDay(project.versionSavedAt),
    printedOn: formatDate(input.now.toISOString()),
    printedOnIso: isoDay(input.now.toISOString()),
    history: revisionsOf(history, project.currentVersion, input.memberNames ?? NO_NAMES),
    spec: project.spec,
    charts,
    flats,
    ...(input.production === undefined ? {} : { production: input.production }),
  });
}

/**
 * The drawings of a document as pictures, with the artwork's pictures in them. They are made from
 * the document itself, so they show what its table says.
 */
export function techPackPictures(pack: TechPack, images: ImageMap, picturesNote: string | null): TechPackPictures {
  return {
    flats: pack.flats.views.map((view) => ({
      view: view.view,
      label: view.label,
      src: view.model ? svgDataUri(renderSvg(view.model, images)) : null,
      alt: view.description,
      toScale: view.toScale,
      notice: view.notice,
    })),
    colourwayFlats: pack.colourways.colourways.map((block) => ({
      colourwayId: block.id,
      view: block.drawing.view,
      label: block.drawing.label,
      src: block.drawing.model ? svgDataUri(renderSvg(block.drawing.model, images)) : null,
      alt: block.drawing.description,
      toScale: block.drawing.toScale,
      notice: block.drawing.notice,
    })),
    picturesNote,
  };
}

/**
 * Everything the tech pack page shows, worked out on the server as plain data: the document,
 * the count of what is left to confirm, the two drawings as pictures, and what each form holds.
 * The document is built from the one version of the design, so the drawings, the table and the
 * document cannot disagree.
 */
export function buildTechPackPage(input: TechPackPageInput): TechPackPageData {
  const core = buildTechPackCore(input);
  return { ...core, ...techPackPictures(core.pack, input.images, input.picturesNote ?? null) };
}

/** The page without its pictures. Nothing here reads the artwork's pictures. */
export function buildTechPackCore(input: PackInput): TechPackCoreData {
  const { project, history } = input;
  const pack = buildPackFor(input);
  const report = completenessReport(pack);
  return {
    projectId: project.id,
    name: project.name,
    version: project.currentVersion,
    pack,
    report,
    sentence: confirmSentence(report),
    staleNote: historyIsNewer(project, history) ? STALE_SENTENCE : null,
    forms: {
      cover: {
        name: project.name,
        styleNumber: project.styleNumber,
        season: project.season,
        sizesText: sizesText(project.spec.sizing),
        baseSize: project.spec.sizing?.baseSize ?? "",
        sizesSet: project.spec.sizing !== null,
      },
      measurements: measurementFormRows(project.spec, pack),
      colourways: colourwayFormRows(project.spec),
      fabrics: fabricRows(project.spec),
      panels: panelFabricRows(project.spec),
      components: componentRows(project.spec),
      seams: seamRows(project.spec),
      labelling: labellingRows(project.spec),
    },
    confirmables: confirmables(project.spec, pack),
    spec: project.spec,
  };
}
