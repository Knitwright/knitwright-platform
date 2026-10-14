import type { ReadinessItem } from "@/lib/production/contract";
import { listOf } from "../text";
import { SECTION_TITLES, type MeasurementsSection } from "../types";
import type { CompletenessReport } from "../completeness";
import type { ColourStandard, ProductionInput } from "./input";
import { patternItems } from "./readiness-pattern";
import { printItems } from "./readiness-print";
import { strikeOffForRelease, strikeOffMismatch } from "./strike-off";
import type { OnPatternTable, ReadinessActor, ReadinessGroup, ReadinessLine, ReadinessSection } from "./types";

type Item = ReadinessItem;

export const READY_WORDS = "Ready for the factory";

export const ACTOR_LABELS: Readonly<Record<ReadinessActor, string>> = {
  owner: "You",
  technician: "A pattern technician",
  "print-house": "Your print house",
  factory: "Your factory",
  club: "The club",
};

/** How far a reduction may differ from the fabric's tested stretch, in percentage points. */
const REDUCTION_TOLERANCE_PCT = 0.5;

const item = (id: string, whoActs: Item["whoActs"], met: boolean, whenMet: string, whenOpen: string): Item => ({
  id,
  whoActs,
  met,
  sentence: met ? whenMet : whenOpen,
});

export interface ReadinessContext {
  readonly input: ProductionInput;
  /** The size labels of the design. */
  readonly orderedSizes: readonly string[];
  readonly measurements: MeasurementsSection;
  readonly onPattern: OnPatternTable | null;
  readonly completeness: Pick<CompletenessReport, "sections" | "proposed">;
  readonly colours: readonly ColourStandard[];
  /** True when the design has player names or numbers, so it needs a team order. */
  readonly needsRoster: boolean;
}

function specItems(ctx: ReadinessContext): Item[] {
  const rows = ctx.measurements.groups.flatMap((group) => group.rows);
  const gaps = rows.filter((row) => row.tolerance.status !== "set" || row.values.some((value) => value.status !== "set"));
  const cells = ctx.onPattern?.rows.flatMap((row) => row.cells) ?? [];
  const unmeasured = cells.filter((cell) => cell.result === "not-measured");
  const outside = (ctx.onPattern?.rows ?? []).filter((row) => row.cells.some((cell) => cell.result === "outside"));
  return [
    item(
      "spec-targets",
      "owner",
      rows.length > 0 && gaps.length === 0,
      "Every measurement has a target and a tolerance at every size.",
      rows.length === 0 ? "Set the sizes and measurements of the design." : `Give a target and a tolerance for ${listOf(gaps.map((row) => row.label))}.`,
    ),
    item(
      "spec-measured",
      "technician",
      ctx.onPattern !== null && cells.length > 0 && unmeasured.length === 0,
      "Every measurement is measured on the pattern at every size.",
      ctx.onPattern === null ? "Measurements are taken from the pattern once it is in the library." : `${unmeasured.length} ${unmeasured.length === 1 ? "value has" : "values have"} not been measured on the pattern.`,
    ),
    item(
      "spec-in-tolerance",
      "technician",
      ctx.onPattern !== null && cells.length > 0 && outside.length === 0,
      "Every measurement on the pattern is inside its tolerance.",
      ctx.onPattern === null ? "Nothing is measured on the pattern yet." : `Change the pattern or the target for ${listOf(outside.map((row) => row.label))}: they are outside the tolerance.`,
    ),
  ];
}

const TESTED = (source: string): boolean => source === "fabric-test";

function reductionMatches(input: ProductionInput): boolean {
  const { fabric, blockReduction } = input;
  if (!fabric || !blockReduction) return false;
  const { stretchLengthPct: l, stretchWidthPct: w } = fabric;
  return (
    l.value !== null && w.value !== null && TESTED(l.source) && TESTED(w.source) &&
    Math.abs(blockReduction.lengthPct - l.value) <= REDUCTION_TOLERANCE_PCT &&
    Math.abs(blockReduction.widthPct - w.value) <= REDUCTION_TOLERANCE_PCT
  );
}

function fabricItems(input: ProductionInput): Item[] {
  const f = input.fabric;
  const tested = f != null && [f.stretchLengthPct, f.stretchWidthPct, f.shrinkLengthPct, f.shrinkWidthPct].every((v) => TESTED(v.source) && v.value !== null);
  const widthKnown = f != null && f.usableWidthMm.value !== null && (TESTED(f.usableWidthMm.source) || f.usableWidthMm.source === "supplier-sheet");
  const basisKnown = widthKnown && input.marker != null && input.marker.source !== "knitwright-default";
  return [
    item(
      "fabric-test",
      "print-house",
      tested,
      "Stretch and shrink come from a fabric test.",
      "The mill or print house gives a fabric test for stretch and for shrink in the press. Until then artwork is not scaled for shrink.",
    ),
    item(
      "fabric-reduction",
      "technician",
      reductionMatches(input),
      "The pattern's reduction matches the fabric test.",
      "A technician sets the pattern's reduction from the fabric test and records it with the pattern.",
    ),
    item(
      "fabric-use-basis",
      "factory",
      basisKnown,
      "Fabric use is worked out from the usable width and the factory's marker.",
      "Your factory gives the usable width of the fabric and how well its marker fits the pieces. Until then fabric use uses a Knitwright default.",
    ),
  ];
}

function proofItems(input: ProductionInput): Item[] {
  const strike = strikeOffForRelease(input);
  const mismatch = strikeOffMismatch(input);
  const asked = "A named person accepts the strike-off for this release.";
  return [
    item(
      "proof-strike-off",
      "owner",
      strike !== null,
      `The strike-off was accepted by ${strike?.name ?? ""} on ${strike?.date ?? ""}.`,
      mismatch === null ? `${asked} No strike-off has been recorded.` : mismatch.includes("not for") ? `${mismatch} ${asked}` : `${asked} ${mismatch}`,
    ),
  ];
}

function orderItems(ctx: ReadinessContext): Item[] {
  const problems = ctx.input.rosterProblems ?? null;
  if (!ctx.needsRoster && problems === null) {
    return [item("order-roster", "club", true, "This design has no player names or numbers, so it needs no team order.", "")];
  }
  return [
    item(
      "order-roster",
      "club",
      problems !== null && problems.length === 0,
      "The team order has no problems.",
      problems === null ? "The club gives the team order: each player's name, number and size." : `The club fixes the team order: ${listOf(problems)}.`,
    ),
  ];
}

function releaseItems(input: ProductionInput): Item[] {
  const release = input.release ?? null;
  return [
    item(
      "release-frozen",
      "owner",
      release !== null,
      `Release ${release?.id ?? ""} is frozen with ${release?.files ?? 0} files and their hashes.`,
      "Freeze a release so the same files can be made again for a reorder.",
    ),
  ];
}

function componentItems(completeness: ReadinessContext["completeness"]): Item[] {
  const empty = completeness.sections.filter((section) => section.id === "components" || section.id === "construction").reduce((sum, section) => sum + section.items.length, 0);
  return [
    item(
      "components-filled",
      "owner",
      empty === 0,
      "Every component and seam is filled in.",
      `${empty} ${empty === 1 ? "component or seam is" : "components and seams are"} still empty.`,
    ),
    item(
      "components-no-proposals",
      "owner",
      completeness.proposed === 0,
      "Nothing is left as a proposal.",
      `${completeness.proposed} ${completeness.proposed === 1 ? "part or stitch is" : "parts and stitches are"} still only proposed by Knitwright.`,
    ),
  ];
}

const line = (entry: Item): ReadinessLine => ({ ...entry, actorLabel: ACTOR_LABELS[entry.whoActs] });

const group = (id: string, title: string, items: readonly Item[]): ReadinessGroup => ({ id, title, items: items.map(line) });

const summaryOf = (open: number): string =>
  open === 0 ? `${READY_WORDS}.` : `Not ready for the factory yet: ${open} ${open === 1 ? "thing is" : "things are"} left.`;

/**
 * The definition of "Ready for the factory" (plans/production-outputs.md, W5): eight groups of
 * conditions, each computed from records. An item that is not met is one sentence that names who
 * acts. Nothing is read from a person's say-so except a named record.
 */
export function buildReadiness(ctx: ReadinessContext): ReadinessSection {
  const groups = [
    group("pattern", "Pattern", patternItems(ctx.input, ctx.orderedSizes)),
    group("spec", "Specification", specItems(ctx)),
    group("fabric", "Fabric", fabricItems(ctx.input)),
    group("print", "Print", printItems(ctx.input, ctx.orderedSizes, ctx.colours)),
    group("proof", "Proof", proofItems(ctx.input)),
    group("order", "Order", orderItems(ctx)),
    group("release", "Release", releaseItems(ctx.input)),
    group("components", "Components and construction", componentItems(ctx.completeness)),
  ];
  const open = groups.flatMap((g) => g.items).filter((entry) => !entry.met);
  const actors = (Object.keys(ACTOR_LABELS) as ReadinessActor[]).flatMap((whoActs) => {
    const count = open.filter((entry) => entry.whoActs === whoActs).length;
    return count === 0 ? [] : [{ whoActs, actorLabel: ACTOR_LABELS[whoActs], count }];
  });
  return {
    id: "readiness",
    title: SECTION_TITLES.readiness,
    note: null,
    ready: open.length === 0,
    summary: summaryOf(open.length),
    groups,
    open: actors,
  };
}
