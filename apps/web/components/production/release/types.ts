export interface ReleaseSummary {
  readonly id: string;
  readonly number: number;
  readonly label: string;
  readonly createdAt: string;
}

/** What the pattern, fabric and print parts say today. Supplied by the part of the app that holds them. */
export interface FreezeInputs {
  readonly orderId: string | null;
  readonly patternBlockId: string;
  readonly patternBlockVersion: number;
  readonly fabricTestIds: readonly string[];
  readonly printProfile: Readonly<Record<string, unknown>>;
  readonly files: readonly Readonly<Record<string, unknown>>[];
}

export interface StrikeOffView {
  readonly id: string;
  readonly status: "requested" | "received" | "accepted" | "rejected";
  readonly sentence: string;
  readonly requestedNote: string;
  readonly shrinkLengthPct: number | null;
  readonly shrinkWidthPct: number | null;
  readonly colourNotes: readonly { colour: string; note: string }[];
  readonly photoFileIds: readonly string[];
}

export interface ReleaseDetailView {
  readonly id: string;
  readonly number: number;
  readonly label: string;
  readonly createdAt: string;
  readonly specVersion: number;
  readonly patternBlockId: string;
  readonly patternBlockVersion: number;
  readonly fabricTestIds: readonly string[];
  readonly printProfile: { bleedMm: number; dpi: number; maxPrintWidthMm: number | null; source: string };
  readonly hasTeamList: boolean;
  readonly files: readonly { path: string; sha256: string }[];
  readonly signOffs: readonly { role: string; label: string; sentence: string; signOff: unknown | null }[];
  readonly strikeOffs: readonly StrikeOffView[];
  readonly proofs: { met: boolean; sentence: string };
}

export interface ReorderReport {
  readonly identical: boolean;
  readonly differences: readonly { code: string; message: string }[];
  readonly files: readonly { path: string; status: "same" | "changed" | "missing" }[];
}
