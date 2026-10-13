import {
  POINT_GROUPS,
  PROVENANCE_LABELS,
  getType,
  type GarmentSpec,
  type PointGroup,
} from "@/lib/garment";
import {
  resolveMeasurements,
  sizingFromChart,
  type ChartSet,
  type Resolution,
  type ResolutionRow,
} from "@/lib/sizing";
import { cmText } from "./measurement-input";
import { toneOf, type Tone } from "./provenance-tone";

export interface TableRow {
  readonly pointId: string;
  readonly label: string;
  readonly howToMeasure: string;
  readonly hasValue: boolean;
  /** Centimetres, ready for a field. Empty when there is no value: never a zero. */
  readonly valueCm: string;
  /** The same value in whole tenths of a millimetre, or null when there is none. */
  readonly valueTenths: number | null;
  /** True when a person typed the value, so they can clear it. */
  readonly isOwn: boolean;
  readonly tolerance: string;
  /** Where the value came from, in plain words. Null when there is no value. */
  readonly provenanceLabel: string | null;
  readonly tone: Tone | null;
  /** A sentence to show under the row: what to do when it is missing, or a note. */
  readonly message: string | null;
  /** True when the person typed this value and the chart has one to go back to. */
  readonly canResetToChart: boolean;
}

export interface TableGroup {
  readonly group: PointGroup;
  readonly label: string;
  readonly rows: readonly TableRow[];
}

export interface MeasurementTable {
  /** The size the values are for. Empty when the design has no sizes and no chart does. */
  readonly size: string;
  /** One sentence for the whole table, such as "no size chart applies". */
  readonly notice: string | null;
  readonly groups: readonly TableGroup[];
}

const TO_BE_CONFIRMED = "To be confirmed";

/** The size a design's values are for: its own base size, else the chart's, else none. */
export const tableSize = (spec: GarmentSpec, charts?: ChartSet): string => {
  if (spec.sizing) return spec.sizing.baseSize;
  const fromChart = sizingFromChart(spec, charts);
  return fromChart.ok ? (fromChart.action.sizing?.baseSize ?? "") : "";
};

const toleranceText = (tolerance: number | null): string =>
  tolerance === null ? TO_BE_CONFIRMED : `±${cmText(tolerance)} cm`;

/** The points that would have a value from the chart if the person's own were removed. */
const chartBacked = (spec: GarmentSpec, size: string, charts?: ChartSet): ReadonlySet<string> => {
  const chartOnly = resolveMeasurements({ ...spec, measurements: [] }, size, charts);
  if (chartOnly.status !== "resolved") return new Set();
  return new Set(chartOnly.rows.filter((row) => row.status === "set").map((row) => row.pointId));
};

const isPersons = (row: ResolutionRow): boolean => row.status === "set" && toneOf(row.provenance) === "person";

const NO_VALUE_YET = "No value yet. Type one in.";

const toTableRow = (
  row: ResolutionRow,
  howToMeasure: string,
  charts: ReadonlySet<string>,
  noChart: boolean,
): TableRow => {
  const shared = { pointId: row.pointId, label: row.label, howToMeasure };
  if (row.status === "missing") {
    return {
      ...shared,
      hasValue: false,
      valueCm: "",
      valueTenths: null,
      isOwn: false,
      tolerance: TO_BE_CONFIRMED,
      provenanceLabel: null,
      tone: null,
      // With no chart, the reason is said once for the whole table, not on every row.
      message: noChart ? NO_VALUE_YET : row.message,
      canResetToChart: false,
    };
  }
  return {
    ...shared,
    hasValue: true,
    valueCm: cmText(row.value),
    valueTenths: row.value,
    isOwn: isPersons(row),
    tolerance: toleranceText(row.tolerance),
    provenanceLabel: PROVENANCE_LABELS[row.provenance],
    tone: toneOf(row.provenance),
    message: row.note,
    canResetToChart: isPersons(row) && charts.has(row.pointId),
  };
};

const noticeOf = (resolution: Resolution): string | null => {
  if (resolution.status !== "resolved") return resolution.message;
  const notes = [resolution.chartNote, resolution.fitNote].filter((note): note is string => note !== null);
  return notes.length > 0 ? notes.join(" ") : null;
};

/**
 * What the measurement table shows, section by section, for a design at its base size.
 * Every row comes from the registry and the sizing library: the values, where each one
 * came from, and the tolerance. A value that is missing has an empty field and a sentence.
 */
export const measurementTable = (spec: GarmentSpec, charts?: ChartSet): MeasurementTable => {
  const size = tableSize(spec, charts);
  const resolution = resolveMeasurements(spec, size, charts);
  const points = getType(spec.typeId)?.pointsOfMeasure ?? [];
  const howTo = new Map(points.map((point) => [point.id, point.howToMeasure]));
  const backed = chartBacked(spec, size, charts);

  const rows = resolution.rows.map((row) => ({
    group: row.group,
    row: toTableRow(row, howTo.get(row.pointId) ?? "", backed, resolution.status === "no-chart"),
  }));
  const groups = POINT_GROUPS.map((group) => ({
    group,
    label: resolution.rows.find((row) => row.group === group)?.groupLabel ?? group,
    rows: rows.filter((entry) => entry.group === group).map((entry) => entry.row),
  })).filter((group) => group.rows.length > 0);

  return { size, notice: noticeOf(resolution), groups };
};
