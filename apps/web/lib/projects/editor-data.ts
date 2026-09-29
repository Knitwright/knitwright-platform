import type { Dropped, GarmentSpec } from "@/lib/garment";
import type { ChartSet } from "@/lib/sizing";
import { picturesNote, type LoadedPictures } from "./artwork-images";
import { artworkRows, placeableParts, type ArtworkRow, type Part } from "./artwork-controls";
import { activeColourwayId, colourRows, colourwayChoices, type ColourRow, type ColourwayChoice } from "./colour-controls";
import { optionControls, type OptionControl } from "./controls";
import { formatDateTime } from "./dates";
import { flatPreview, type FlatPreviewData } from "./flat-preview";
import { measurementTable, type MeasurementTable } from "./measurement-table";
import type { OpenProject, VersionsPage } from "./service";
import { sizesText } from "./sizing-form";
import { undoTarget } from "./undo";
import { wearerLabel } from "./wearers";

export interface VersionView {
  readonly version: number;
  readonly note: string;
  readonly restoredFrom: number | null;
  readonly when: string;
  readonly isCurrent: boolean;
}

export interface EditorData {
  readonly projectId: string;
  readonly name: string;
  readonly styleNumber: string;
  readonly season: string;
  readonly typeLabel: string;
  readonly wearerLabel: string;
  readonly version: number;
  /** The design itself. The editor builds its change requests from it. */
  readonly spec: GarmentSpec;
  readonly controls: readonly OptionControl[];
  /** The drawing of both sides, or null for a type that has none. */
  readonly flat: FlatPreviewData | null;
  /** The colourway that is drawn and edited, and all the colourways the design has. */
  readonly colourwayId: string;
  readonly colourways: readonly ColourwayChoice[];
  /** One row for every part of the design that can be given a colour. */
  readonly colours: readonly ColourRow[];
  readonly artwork: readonly ArtworkRow[];
  /** The parts that can carry artwork, and the places on each. */
  readonly parts: readonly Part[];
  readonly table: MeasurementTable;
  readonly sizes: Readonly<{ text: string; baseSize: string; set: boolean }>;
  readonly versions: readonly VersionView[];
  /** True when the design has older versions than the history lists. */
  readonly olderVersionsHidden: boolean;
  /** The version an undo goes back to, or null when there is nothing before the current design. */
  readonly undoTo: number | null;
  readonly dropped: readonly Dropped[];
}

/**
 * Everything the editor shows, worked out on the server as plain data. Nothing here names
 * an option, a choice or a measurement: it all comes from the design and the registry.
 */
export const buildEditorData = (
  project: OpenProject,
  history: VersionsPage,
  charts?: ChartSet,
  pictures: LoadedPictures = { images: new Map(), skipped: 0 },
  colourwayId?: string,
): EditorData => ({
  projectId: project.id,
  name: project.name,
  styleNumber: project.styleNumber,
  season: project.season,
  typeLabel: project.garmentLabel,
  wearerLabel: wearerLabel(project.spec.wearer),
  version: project.currentVersion,
  spec: project.spec,
  controls: optionControls(project.spec),
  flat: flatPreview(project.spec, pictures.images, charts, picturesNote(pictures.skipped), colourwayId),
  colourwayId: activeColourwayId(project.spec, colourwayId),
  colourways: colourwayChoices(project.spec, colourwayId),
  colours: colourRows(project.spec, colourwayId),
  artwork: artworkRows(project.spec),
  parts: placeableParts(project.spec),
  table: measurementTable(project.spec, charts),
  sizes: {
    text: sizesText(project.spec.sizing),
    baseSize: project.spec.sizing?.baseSize ?? "",
    set: project.spec.sizing !== null,
  },
  olderVersionsHidden: history.hasMore,
  versions: history.versions.map((entry) => ({
    version: entry.version,
    note: entry.note,
    restoredFrom: entry.restoredFrom,
    when: formatDateTime(entry.createdAt),
    isCurrent: entry.version === project.currentVersion,
  })),
  undoTo: undoTarget(history.versions),
  dropped: project.dropped,
});
