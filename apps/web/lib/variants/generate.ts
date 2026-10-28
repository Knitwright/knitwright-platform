import type { GarmentSpec } from "@/lib/garment";
import { DEFAULT_SETTINGS, runGuardrails, type Finding, type UsedColour } from "@/lib/guardrails";
import { deepEqual, sameDesign } from "@/lib/projects/same-design";
import { applyAll, colourwayCandidates, kitStyleCandidates, placementCandidates, type Candidate } from "./candidates";
import { shortHash, shuffled } from "./random";
import { MAX_VARIANTS, MIN_VARIANTS, type GenerateOptions, type Variant, type VariantFinding, type VariantGate, type VariantKind } from "./types";

export type { VariantGate } from "./types";

const KIND_ORDER: readonly VariantKind[] = ["colourway", "kit-style", "placement"];

/** What a variant may change: colours, the kit pattern and where artwork sits. Everything else is structure. */
const CHANGEABLE = ["colourways", "kitPattern", "artwork", "artworkStack"] as const;

const withoutChangeable = (spec: GarmentSpec): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...spec };
  for (const key of CHANGEABLE) delete copy[key];
  return copy;
};

/**
 * True when `after` has the same structure as `before`: the same garment, options, measurements, fabrics,
 * construction and labelling, and the same artwork items (same id, panel, file or text, size and turn), only perhaps placed elsewhere.
 */
export function structureKept(before: GarmentSpec, after: GarmentSpec): boolean {
  if (!deepEqual(withoutChangeable(before), withoutChangeable(after))) return false;
  if (before.artwork.length !== after.artwork.length) return false;
  return before.artwork.every((item, index) => {
    const other = after.artwork[index];
    return deepEqual({ ...item, anchor: "", offsetX: 0, offsetY: 0, provenance: "" }, { ...other, anchor: "", offsetX: 0, offsetY: 0, provenance: "" });
  });
}

const usedColours = (spec: GarmentSpec): UsedColour[] => [
  ...spec.colourways[0].colours.flatMap((entry) => (entry.swatch ? [{ id: entry.panelId, label: `The ${entry.panelId} colour`, hex: entry.swatch }] : [])),
  ...(spec.kitPattern?.colours ?? []).flatMap((entry, index) => (entry.swatch ? [{ id: `kit-pattern-${index}`, label: "A pattern colour", hex: entry.swatch }] : [])),
];

const fromGuardrail = (finding: Finding): VariantFinding => ({
  code: finding.code,
  severity: finding.severity,
  panel: finding.panel,
  message: finding.message,
});

/**
 * The guardrails that can run on a design today. Only the colour estimate has input: nothing yet turns artwork into placed boxes on
 * pattern panels (decision 0045), so the seam, dpi, bleed and safe-zone checks run on no items.
 */
export function guardrailFindings(spec: GarmentSpec): readonly VariantFinding[] {
  return runGuardrails({ panels: [], items: [], colours: usedColours(spec), settings: DEFAULT_SETTINGS }).map(fromGuardrail);
}

const keyOf = (finding: VariantFinding): string => `${finding.code}|${finding.panel ?? ""}`;

const findingsOf = (spec: GarmentSpec, gate: VariantGate | undefined): readonly VariantFinding[] => [...guardrailFindings(spec), ...(gate?.(spec) ?? [])];

const clampCount = (count: number): number => Math.min(MAX_VARIANTS, Math.max(MIN_VARIANTS, Math.trunc(count)));

/** Candidates per kind, each in an order fixed by the seed, except that a kind's first candidate stays first. */
function queues(spec: GarmentSpec, seed: number): Record<VariantKind, Candidate[]> {
  const order = (list: readonly Candidate[], salt: number, keepFirst: boolean): Candidate[] =>
    keepFirst ? [...list.slice(0, 1), ...shuffled(list.slice(1), seed + salt)] : shuffled(list, seed + salt);
  return {
    colourway: order(colourwayCandidates(spec), 1, true),
    "kit-style": order(kitStyleCandidates(spec), 2, false),
    placement: order(placementCandidates(spec), 3, false),
  };
}

/**
 * Alternatives for a design: colourways, kit-style swaps and placement moves, each a set of ordinary
 * design changes. Pure and deterministic for a design and seed. Candidates are taken from each kind in turn.
 * One that changes nothing, repeats another, or brings a blocker the design does not already have (from
 * the guardrails or the gate) is dropped and the next is tried. The count is brought into 8 to 12; fewer
 * come back only when the design has fewer valid alternatives.
 */
export function generateVariants(spec: GarmentSpec, options: GenerateOptions): readonly Variant[] {
  const want = clampCount(options.count);
  const known = new Set(findingsOf(spec, options.gate).filter((f) => f.severity === "blocker").map(keyOf));
  const waiting = queues(spec, options.seed);
  const chosen: Variant[] = [];
  const seen: GarmentSpec[] = [spec];
  while (chosen.length < want && KIND_ORDER.some((kind) => waiting[kind].length > 0)) {
    for (const kind of KIND_ORDER) {
      const candidate = waiting[kind].shift();
      if (!candidate || chosen.length >= want) continue;
      const next = applyAll(spec, candidate.actions);
      if (!next || !structureKept(spec, next) || seen.some((other) => sameDesign(other, next))) continue;
      const findings = findingsOf(next, options.gate);
      if (findings.some((f) => f.severity === "blocker" && !known.has(keyOf(f)))) continue;
      seen.push(next);
      chosen.push({
        id: `v-${shortHash(JSON.stringify([candidate.kind, candidate.actions]))}`,
        kind: candidate.kind,
        label: candidate.label,
        summary: candidate.summary,
        actions: candidate.actions,
        spec: next,
        warnings: findings.filter((f) => f.severity === "warning"),
      });
    }
  }
  return chosen;
}
