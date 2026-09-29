import type { PointGroup, Provenance } from "@/lib/garment";
import type { ChartSource, SizeChart } from "./schemas";

export type SizesFrom = "design" | "chart";

/** A value with a known origin. Every one carries a provenance. */
export interface SetRow {
  readonly status: "set";
  readonly pointId: string;
  readonly label: string;
  /** The section of the measurement table this point belongs in. */
  readonly group: PointGroup;
  readonly groupLabel: string;
  /** Whole tenths of a millimetre, always above zero. */
  readonly value: number;
  /** Plus or minus, in tenths of a millimetre. Null means "to be confirmed". */
  readonly tolerance: number | null;
  readonly provenance: Provenance;
  /** A plain sentence when there is something to explain, otherwise null. */
  readonly note: string | null;
}

/** A point that applies but has no value. It never carries a number. */
export interface MissingRow {
  readonly status: "missing";
  readonly pointId: string;
  readonly label: string;
  /** The section of the measurement table this point belongs in. */
  readonly group: PointGroup;
  readonly groupLabel: string;
  readonly message: string;
}

export type ResolutionRow = SetRow | MissingRow;

/** There is no usable chart. Nothing is guessed. Rows hold only what the user typed. */
export interface NoChartResolution {
  readonly status: "no-chart";
  readonly message: string;
  readonly size: string;
  readonly rows: readonly ResolutionRow[];
}

/** The size asked for is not in the size run. */
export interface UnknownSizeResolution {
  readonly status: "unknown-size";
  readonly message: string;
  readonly size: string;
  readonly sizes: readonly string[];
  /** Says whether the sizes came from the design or, when it has none, from the size chart. */
  readonly sizesFrom: SizesFrom;
  readonly rows: readonly [];
}

export interface ResolvedResolution {
  readonly status: "resolved";
  readonly size: string;
  readonly baseSize: string;
  /** The sizes of the design, smallest first. */
  readonly sizes: readonly string[];
  /** Says whether the sizes came from the design or, when it has none, from the size chart. */
  readonly sizesFrom: SizesFrom;
  /** The fit the chart was made for, or null when it is used for every fit. */
  /** Sizes of the design that the chart does not have. Their rows are missing. */
  readonly sizesMissingFromChart: readonly string[];
  readonly chartFit: SizeChart["fit"];
  /** Says so when a chart with no fit is used for a design that has a fit, otherwise null. */
  readonly fitNote: string | null;
  readonly source: ChartSource;
  /** One row for every point of measure that applies, in the garment type order. */
  readonly rows: readonly ResolutionRow[];
  readonly message: null;
}

export type Resolution = NoChartResolution | UnknownSizeResolution | ResolvedResolution;
