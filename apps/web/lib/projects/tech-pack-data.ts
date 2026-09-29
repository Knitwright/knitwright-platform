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
import { formatDate } from "./dates";
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
  /** The date to print, already written in words. */
  readonly printedOn: string;
  readonly charts?: ChartSet;
  readonly picturesNote?: string | null;
}

/** A date as it is printed on the document, in words and in UTC, from a clock the caller reads. */
export const printedDate = (now: Date): string => formatDate(now.toISOString());

const revisionsOf = (history: VersionsPage): readonly RevisionInput[] =>
  history.versions.map((entry) => ({ version: entry.version, date: formatDate(entry.createdAt), note: entry.note, by: null }));

/** The date the shown version was saved. A version missing from the history takes the day the design last changed. */
const versionDate = (project: OpenProject, history: VersionsPage): string =>
  formatDate(history.versions.find((entry) => entry.version === project.currentVersion)?.createdAt ?? project.updatedAt);

/**
 * Everything the tech pack page shows, worked out on the server as plain data: the document,
 * the count of what is left to confirm, the two drawings as pictures, and what each form holds.
 * The document is built from the one version of the design, so the drawings, the table and the
 * document cannot disagree.
 */
export function buildTechPackPage(input: TechPackPageInput): TechPackPageData {
  const { project, history, images, charts } = input;
  const flats = flatsForTechPack(project.spec, charts);
  const pack = buildTechPack({
    project: { name: project.name, styleNumber: project.styleNumber, season: project.season, brandName: input.brandName },
    version: project.currentVersion,
    versionDate: versionDate(project, history),
    printedOn: input.printedOn,
    history: revisionsOf(history),
    spec: project.spec,
    charts,
    flats,
  });
  const report = completenessReport(pack);
  return {
    projectId: project.id,
    name: project.name,
    version: project.currentVersion,
    pack,
    report,
    sentence: confirmSentence(report.total),
    flats: pack.flats.views.map((view) => ({
      view: view.view,
      label: view.label,
      src: view.model ? svgDataUri(renderSvg(view.model, images)) : null,
      alt: view.description,
      toScale: view.toScale,
      notice: view.notice,
    })),
    picturesNote: input.picturesNote ?? null,
    forms: {
      fabrics: fabricRows(project.spec),
      panels: panelFabricRows(project.spec),
      components: componentRows(project.spec),
      seams: seamRows(project.spec),
      labelling: labellingRows(project.spec),
    },
  };
}
