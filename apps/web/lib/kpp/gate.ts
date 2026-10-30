import { isInsideApproxGamut } from "@/lib/guardrails/gamut";
import { GAP_RULE, type KppInput } from "./model";

/**
 * The F-G2 pre-export check for the production package (docs/spec/02-features.md F-G2). The
 * package is not built while any of these hold, and the refusal lists every one:
 * a field still "needs your input"; `[TBC]` anywhere; a POM, BOM row, colour or label line
 * missing; print files below the rules' DPI or bleed; a design whose moderation is not clear.
 * The check is deterministic: the same input gives the same list in the same order.
 *
 * F-G2's gamut item is a warning, not a blocker: `lib/guardrails/gamut` is an estimate made
 * without any print house's ICC profile, so it may neither pass nor fail a colour truthfully.
 * `packageWarnings` returns those lines and the README carries them, so the factory reads them
 * before cutting. Decision 0070 records why.
 */

export interface GateIssue {
  /** Where in the package input, as a dotted path. */
  readonly path: string;
  readonly message: string;
  readonly ruleId: string;
}

const TBC = "[TBC]";
const HEX = /^#[0-9A-Fa-f]{6}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Every string holding `[TBC]`, with its path. */
function tbcPaths(value: unknown, path: string, out: string[]): void {
  if (typeof value === "string" && value.toUpperCase().includes(TBC)) out.push(path);
  else if (Array.isArray(value)) value.forEach((v, i) => tbcPaths(v, `${path}[${i}]`, out));
  else if (isRecord(value)) for (const key of Object.keys(value).sort()) tbcPaths(value[key], path === "" ? key : `${path}.${key}`, out);
}

const blank = (value: string | null | undefined): boolean => value === null || value === undefined || value.trim() === "";

function fieldIssues(input: KppInput): GateIssue[] {
  return input.fields.flatMap((f) =>
    f.provenance === "needs_input" || blank(f.value) ? [{ path: `fields.${f.id}`, message: `${f.label}: needs your input.`, ruleId: f.ruleId }] : [],
  );
}

function pomIssues(input: KppInput): GateIssue[] {
  if (input.poms.length === 0) return [{ path: "poms", message: "Points of measure: none are listed.", ruleId: GAP_RULE }];
  return input.poms.flatMap((pom, i) => {
    const at = `poms[${i}]`;
    const missing = input.design.sizes.filter((size) => pom.values[size] === null || pom.values[size] === undefined);
    return [
      ...(pom.provenance === "needs_input" ? [{ path: at, message: `POM ${pom.letter} ${pom.description}: needs your input.`, ruleId: pom.ruleId }] : []),
      ...(missing.length > 0 ? [{ path: `${at}.values`, message: `POM ${pom.letter} ${pom.description}: no value for ${missing.join(", ")}.`, ruleId: pom.ruleId }] : []),
      ...(pom.tolMinusMm === null || pom.tolPlusMm === null ? [{ path: `${at}.tolerance`, message: `POM ${pom.letter} ${pom.description}: no tolerance.`, ruleId: pom.ruleId }] : []),
    ];
  });
}

function bomIssues(input: KppInput): GateIssue[] {
  if (input.bom.length === 0) return [{ path: "bom", message: "Bill of materials: no lines.", ruleId: GAP_RULE }];
  if (!input.bom.some((row) => row.type === "fabric")) return [{ path: "bom", message: "Bill of materials: no fabric line.", ruleId: GAP_RULE }];
  return input.bom.flatMap((row, i) => {
    const gaps = [row.provenance === "needs_input" ? "needs your input" : null, blank(row.spec) ? "no specification" : null, blank(row.qtyPerPiece) ? "no quantity" : null, blank(row.unit) ? "no unit" : null].filter((g) => g !== null);
    return gaps.length > 0 ? [{ path: `bom[${i}]`, message: `BOM ${row.item}: ${gaps.join(", ")}.`, ruleId: row.ruleId }] : [];
  });
}

function colourIssues(input: KppInput): GateIssue[] {
  const spec = input.colour;
  const issues: GateIssue[] = blank(spec.fabric) ? [{ path: "colour.fabric", message: "Colour spec: no fabric named.", ruleId: spec.ruleId }] : [];
  if (spec.colours.length === 0) issues.push({ path: "colour.colours", message: "Colour spec: no colour roles.", ruleId: spec.ruleId });
  // Owner decision 15: a colour difference nobody agreed is not written into a package, exactly as a tolerance
  // nobody agreed is not written onto a point of measure (decision 18).
  if (spec.tolerance.max === null) issues.push({ path: "colour.tolerance", message: "Colour spec: no colour difference has been agreed with this factory.", ruleId: spec.ruleId });
  spec.colours.forEach((c, i) => {
    const gaps = [blank(c.hex) || !HEX.test(c.hex ?? "") ? "no valid hex" : null, blank(c.pantoneTcx) ? "no Pantone TCX" : null, blank(c.swatchId) ? "no swatch ID" : null].filter((g) => g !== null);
    if (gaps.length > 0) issues.push({ path: `colour.colours[${i}]`, message: `Colour ${c.role}: ${gaps.join(", ")}.`, ruleId: spec.ruleId });
  });
  return issues;
}

function labelIssues(input: KppInput): GateIssue[] {
  if (input.labels.length === 0) return [{ path: "labels", message: "Care labels: no destination market.", ruleId: GAP_RULE }];
  return input.labels.flatMap((label, i) => {
    const gaps = [
      blank(label.fibre) ? "fibre content" : null,
      label.care.length === 0 ? "care" : null,
      blank(label.origin) ? "origin" : null,
      blank(label.size) ? "size" : null,
      label.importerRequired && blank(label.importer) ? "importer" : null,
    ].filter((g) => g !== null);
    return gaps.length > 0 ? [{ path: `labels[${i}]`, message: `Care label ${label.market.toUpperCase()}: missing ${gaps.join(", ")}.`, ruleId: label.ruleId }] : [];
  });
}

function printIssues(input: KppInput): GateIssue[] {
  const p = input.print;
  return [
    ...(p.dpi < p.minDpi ? [{ path: "print.dpi", message: `Print files: ${p.dpi} DPI is below the ${p.minDpi} DPI the rules ask for.`, ruleId: p.ruleId }] : []),
    ...(p.bleedMm < p.minBleedMm ? [{ path: "print.bleedMm", message: `Print files: ${p.bleedMm} mm bleed is below the ${p.minBleedMm} mm the rules ask for.`, ruleId: p.ruleId }] : []),
  ];
}

function batchIssues(input: KppInput): GateIssue[] {
  if (input.kind !== "batch") return [];
  const issues: GateIssue[] = input.orders.length === 0 ? [{ path: "orders", message: "Batch: no orders.", ruleId: GAP_RULE }] : [];
  const known = new Set(input.design.sizes);
  input.orders.forEach((order, i) => {
    const unknown = Object.keys(order.sizes).filter((s) => !known.has(s));
    if (unknown.length > 0) issues.push({ path: `orders[${i}]`, message: `Order ${order.orderNo}: size ${unknown.join(", ")} is not in the size run.`, ruleId: GAP_RULE });
  });
  return issues;
}

function moderationIssues(input: KppInput): GateIssue[] {
  if (input.moderation === "flagged") return [{ path: "moderation", message: "Moderation: the design is flagged and must be cleared first.", ruleId: GAP_RULE }];
  if (input.moderation === "pending") return [{ path: "moderation", message: "Moderation: the check has not finished.", ruleId: GAP_RULE }];
  return [];
}

/**
 * Sentences the package carries but is not stopped by: F-G2's gamut item, and a moderation check
 * that does not exist yet. The README prints them under "Read before you start".
 */
export function packageWarnings(input: KppInput): readonly string[] {
  const outside = input.colour.colours.filter((c) => c.hex !== null && HEX.test(c.hex) && !isInsideApproxGamut(c.hex));
  return [
    ...(outside.length > 0
      ? [
          `Colour ${outside.map((c) => `${c.role} (${c.hex})`).join(", ")} is very saturated and may print duller on fabric. This is Knitwright's estimate, not a measurement: match the strike-off, not the screen.`,
        ]
      : []),
    ...(input.moderation === "not_built" ? ["The design has not been through a moderation check: none exists yet."] : []),
  ];
}

/** Every reason the package may not be built, or an empty list. */
export function checkPackage(input: KppInput): readonly GateIssue[] {
  const tbc: string[] = [];
  tbcPaths(input, "", tbc);
  return [
    ...fieldIssues(input),
    ...pomIssues(input),
    ...bomIssues(input),
    ...colourIssues(input),
    ...labelIssues(input),
    ...printIssues(input),
    ...batchIssues(input),
    ...moderationIssues(input),
    ...tbc.map((path) => ({ path, message: `${path}: holds [TBC], which a package may not contain.`, ruleId: GAP_RULE })),
  ];
}
