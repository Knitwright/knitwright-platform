import type { ImageMap } from "@/lib/flat/images";
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
import { formatDate, isoDay } from "./dates";
import type { OpenProject, VersionsPage } from "./service";
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

export interface TechPackPageData {
  readonly projectId: string;
  readonly name: string;
  readonly version: number;
  readonly pack: TechPack;
  readonly report: CompletenessReport;
  /** "12 things to confirm." */
  readonly sentence: string;
  readonly flats: readonly FlatPicture[];
  /** One sentence saying some pictures are not shown, or null. */
  readonly picturesNote: string | null;
  /** Says the design changed while the page was loading, or null. */
  readonly staleNote: string | null;
  readonly forms: Readonly<{
    fabrics: readonly FabricFormRow[];
    panels: readonly PanelFabricRow[];
    components: readonly ComponentRow[];
    seams: readonly SeamRow[];
    labelling: readonly LabellingFormRow[];
  }>;
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
}

export const STALE_SENTENCE = "This design was changed while the page was loading. Reload the page to see the latest version.";

/** True when a saved version is newer than the design that was read. The page then reads again. */
export const historyIsNewer = (project: OpenProject, history: VersionsPage): boolean =>
  history.versions.some((entry) => entry.version > project.currentVersion);

/** Only versions up to the design that was read are listed, so the document never mixes two versions. */
const revisionsOf = (history: VersionsPage, current: number): readonly RevisionInput[] =>
  history.versions
    .filter((entry) => entry.version <= current)
    .map((entry) => ({
    version: entry.version,
    date: formatDate(entry.createdAt),
    dateIso: isoDay(entry.createdAt),
    note: entry.note,
    by: null,
  }));

/**
 * The document for one version of a design. The screen and every export are made by this one
 * function from the same inputs, so they cannot disagree: the drawings, the table and the
 * document all come from the one version that was read.
 */
export function buildPackFor(input: TechPackPageInput): TechPack {
  const { project, history, charts } = input;
  const flats = flatsForTechPack(project.spec, charts, input.colourwayId);
  return buildTechPack({
    project: { name: project.name, styleNumber: project.styleNumber, season: project.season, brandName: input.brandName },
    version: project.currentVersion,
    versionDate: formatDate(project.versionSavedAt),
    versionDateIso: isoDay(project.versionSavedAt),
    printedOn: formatDate(input.now.toISOString()),
    printedOnIso: isoDay(input.now.toISOString()),
    history: revisionsOf(history, project.currentVersion),
    spec: project.spec,
    charts,
    flats,
  });
}

/**
 * Everything the tech pack page shows, worked out on the server as plain data: the document,
 * the count of what is left to confirm, the two drawings as pictures, and what each form holds.
 * The document is built from the one version of the design, so the drawings, the table and the
 * document cannot disagree.
 */
export function buildTechPackPage(input: TechPackPageInput): TechPackPageData {
  const { project, history, images } = input;
  const pack = buildPackFor(input);
  const report = completenessReport(pack);
  return {
    projectId: project.id,
    name: project.name,
    version: project.currentVersion,
    pack,
    report,
    sentence: confirmSentence(report),
    flats: pack.flats.views.map((view) => ({
      view: view.view,
      label: view.label,
      src: view.model ? svgDataUri(renderSvg(view.model, images)) : null,
      alt: view.description,
      toScale: view.toScale,
      notice: view.notice,
    })),
    picturesNote: input.picturesNote ?? null,
    staleNote: historyIsNewer(project, history) ? STALE_SENTENCE : null,
    forms: {
      fabrics: fabricRows(project.spec),
      panels: panelFabricRows(project.spec),
      components: componentRows(project.spec),
      seams: seamRows(project.spec),
      labelling: labellingRows(project.spec),
    },
  };
}
