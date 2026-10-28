/** Largest brand run the workspace takes (spec: brand runs are 50 to 300 pieces). Above it, ops is asked first. */
export const MAX_RUN_PIECES = 300;

export type RunKind = "sample" | "run";

/** A minimum order that may be missing. A missing one is never guessed. */
export type Moq = Readonly<{ status: "not-set" }> | Readonly<{ status: "set"; value: number }>;

type FlagCode = "under_moq" | "over_max" | "moq_not_set";
export type Flag = Readonly<{ code: FlagCode; text: string }>;

export type Breakdown = Readonly<{
  /** Pieces by size label, only sizes with at least one piece, in the order of the size run. */
  sizes: Readonly<Record<string, number>>;
  total: number;
  /** Things that stop the order from being sent. */
  errors: readonly string[];
  /** Things the brand should read before sending. They do not stop it. */
  flags: readonly Flag[];
}>;

type BreakdownInput = Readonly<{
  kind: RunKind;
  quantities: Readonly<Record<string, unknown>>;
  /** The design's size run. Empty when the design has none. */
  sizeRun: readonly string[];
  moq: Moq;
}>;

const wholePieces = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99_999;

/** Sizes in the order of the run, then any others by label so the result never depends on input order. */
const ordered = (labels: readonly string[], run: readonly string[]): string[] => {
  const rank = (label: string) => (run.includes(label) ? run.indexOf(label) : run.length);
  return [...labels].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
};

function flagsFor(kind: RunKind, total: number, moq: Moq): Flag[] {
  if (kind === "sample") return [];
  const flags: Flag[] = [];
  if (moq.status === "not-set") {
    flags.push({ code: "moq_not_set", text: "No minimum order is set for this garment yet. Knitwright will confirm it." });
  } else if (total < moq.value) {
    flags.push({ code: "under_moq", text: `${total} pieces is under the minimum order of ${moq.value}.` });
  }
  if (total > MAX_RUN_PIECES) flags.push({ code: "over_max", text: `${total} pieces is over ${MAX_RUN_PIECES}. Brand runs are up to ${MAX_RUN_PIECES} pieces.` });
  return flags;
}

/**
 * Checks a size breakdown against the design's size run and the factory's minimum order. A sample is one piece of each size
 * chosen. A run is flagged, not refused, when it is under the minimum or over 300, so the brand decides with the facts.
 */
export function checkBreakdown(input: BreakdownInput): Breakdown {
  const errors: string[] = [];
  const kept: Record<string, number> = {};
  for (const label of ordered(Object.keys(input.quantities), input.sizeRun)) {
    const quantity = input.quantities[label];
    if (quantity === 0 || quantity === undefined || quantity === null || quantity === "") continue;
    if (!wholePieces(quantity)) {
      errors.push(`Size ${label}: use a whole number of pieces.`);
      continue;
    }
    if (input.sizeRun.length > 0 && !input.sizeRun.includes(label)) errors.push(`Size ${label} is not in this design's size run.`);
    if (input.kind === "sample" && quantity !== 1) errors.push(`Size ${label}: a sample is one piece of each size.`);
    kept[label] = quantity;
  }
  const total = Object.values(kept).reduce((sum, n) => sum + n, 0);
  if (total === 0) errors.push("Choose at least one size.");
  if (Object.keys(kept).length > 40) errors.push("A breakdown can hold at most 40 sizes.");
  return { sizes: kept, total, errors, flags: flagsFor(input.kind, total, input.moq) };
}

/** A typed quantity as a number: "" is left out, a whole number as text is read, anything else stays for checkBreakdown to refuse. */
export function numbersOf(quantities: Readonly<Record<string, number | string>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(quantities).map(([label, value]) => [label, typeof value === "string" ? (/^\s*\d{1,5}\s*$/.test(value) ? Number(value) : value.trim() === "" ? 0 : value) : value]),
  );
}
