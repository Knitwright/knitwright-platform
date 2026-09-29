import type { Dropped, GarmentSpec } from "@/lib/garment";
import type { ChartSet } from "@/lib/sizing";
import { optionControls, type OptionControl } from "./controls";
import { formatDateTime } from "./dates";
import { measurementTable, type MeasurementTable } from "./measurement-table";
import type { OpenProject, VersionSummary } from "./service";
import { sizesText } from "./sizing-form";
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
  readonly table: MeasurementTable;
  readonly sizes: Readonly<{ text: string; baseSize: string; set: boolean }>;
  readonly versions: readonly VersionView[];
  /** The version an undo goes back to, or null on the first version. */
  readonly undoTo: number | null;
  readonly dropped: readonly Dropped[];
}

/**
 * Everything the editor shows, worked out on the server as plain data. Nothing here names
 * an option, a choice or a measurement: it all comes from the design and the registry.
 */
export const buildEditorData = (
  project: OpenProject,
  versions: readonly VersionSummary[],
  charts?: ChartSet,
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
  table: measurementTable(project.spec, charts),
  sizes: {
    text: sizesText(project.spec.sizing),
    baseSize: project.spec.sizing?.baseSize ?? "",
    set: project.spec.sizing !== null,
  },
  versions: versions.map((entry) => ({
    version: entry.version,
    note: entry.note,
    restoredFrom: entry.restoredFrom,
    when: formatDateTime(entry.createdAt),
    isCurrent: entry.version === project.currentVersion,
  })),
  undoTo: project.currentVersion > 1 ? project.currentVersion - 1 : null,
  dropped: project.dropped,
});
