import type { FabricValue, GradedPattern, SizeLabelMap, TeamOrder } from "@/lib/production/contract";
import { cutList, type CutListOptions, type CutRow } from "./cut-list";
import { ESTIMATE_LABEL } from "./marker";

export type Efficiency = Readonly<{
  /** Between 0 and 1: the share of the fabric the pieces cover. */
  value: number;
  source: "knitwright-default" | "marker" | "factory";
  label: string;
}>;

/** Until a marker or the factory gives a figure. A setting, never a measurement. */
export const DEFAULT_EFFICIENCY: Efficiency = { value: 0.8, source: "knitwright-default", label: ESTIMATE_LABEL };

export type FabricWidth = Readonly<{
  mm: number | null;
  source: FabricValue["source"] | "stated-in-request";
}>;

export type FabricUse = Readonly<{
  fabricId: string;
  /** Cut area of the whole garment in square centimetres. */
  areaCm2: number;
  widthMm: number | null;
  widthSource: FabricWidth["source"];
  efficiency: Efficiency;
  /** Fabric length in millimetres, or null when the fabric has no usable width. */
  lengthMm: number | null;
  assumptions: readonly string[];
}>;

const MM2_PER_CM2 = 100;
const CM_PER_MM = 0.1;

const WIDTH_SOURCE_WORDS: Record<FabricWidth["source"], string> = {
  "fabric-test": "from a fabric test",
  "supplier-sheet": "from the supplier's sheet",
  suggested: "suggested, not measured",
  "not-set": "not set",
  "stated-in-request": "stated in the request",
};

function checkEfficiency(e: Efficiency): void {
  if (!(e.value > 0 && e.value <= 1)) throw new RangeError("Efficiency must be above 0 and no more than 1.");
}

function assumptionsFor(rows: readonly CutRow[], width: FabricWidth, efficiency: Efficiency): string[] {
  const out = [
    `Whole pieces are counted: a piece cut on a fold counts both halves, and each piece is counted as many times as it is cut.`,
    `Efficiency ${Math.round(efficiency.value * 100)} %: ${efficiency.label}.`,
  ];
  if (width.mm === null) {
    out.push("This fabric has no usable width yet, so no length can be given.");
  } else {
    out.push(`Usable width ${Math.round(width.mm * CM_PER_MM * 10) / 10} cm, ${WIDTH_SOURCE_WORDS[width.source]}.`);
  }
  if (rows.some((r) => r.outlineNote.includes("does not say"))) {
    out.push("The pattern file does not say whether the outline includes the seam allowance, so none is added here.");
  }
  return out;
}

/** Fabric used by one garment of one size, one line per fabric. */
export function fabricUseForSize(
  rows: readonly CutRow[],
  widths: Readonly<Record<string, FabricWidth>>,
  efficiency: Efficiency = DEFAULT_EFFICIENCY,
): readonly FabricUse[] {
  checkEfficiency(efficiency);
  const ids = [...new Set(rows.map((r) => r.fabricId))].sort();
  return ids.map((fabricId) => {
    const mine = rows.filter((r) => r.fabricId === fabricId);
    const areaCm2 = mine.reduce((sum, r) => sum + r.totalAreaCm2, 0);
    const width: FabricWidth = Object.hasOwn(widths, fabricId) ? (widths[fabricId] as FabricWidth) : { mm: null, source: "not-set" };
    const usable = width.mm !== null && width.mm > 0;
    return {
      fabricId,
      areaCm2,
      widthMm: width.mm,
      widthSource: width.source,
      efficiency,
      lengthMm: usable ? (areaCm2 * MM2_PER_CM2) / ((width.mm as number) * efficiency.value) : null,
      assumptions: assumptionsFor(mine, width, efficiency),
    };
  });
}

export type FabricUseOrder = Readonly<{
  order: TeamOrder;
  pattern: GradedPattern;
  maps: readonly SizeLabelMap[];
  widths: Readonly<Record<string, FabricWidth>>;
  efficiency?: Efficiency;
}> &
  CutListOptions;

export type SizeUse = Readonly<{
  sizeLabel: string;
  cut: SizeLabelMap["cut"];
  patternSize: string;
  garments: number;
  perGarment: readonly FabricUse[];
}>;

export type OrderFabricUse = Readonly<{
  /** Garments counted: rows whose size could not be matched to a pattern are left out. */
  garments: number;
  fabrics: readonly FabricUse[];
  bySize: readonly SizeUse[];
  problems: readonly string[];
}>;

/**
 * Fabric for a whole order, for the instant price to read later: each row's size is mapped to a
 * pattern size, that size's cut list is priced per garment, and the garments are added up. Rows that
 * cannot be matched are named in `problems` and left out, never guessed.
 */
export function fabricUseFor(input: FabricUseOrder): OrderFabricUse {
  const efficiency = input.efficiency ?? DEFAULT_EFFICIENCY;
  const problems: string[] = [];
  const groups = new Map<string, { sizeLabel: string; cut: SizeLabelMap["cut"]; patternSize: string; garments: number }>();
  for (const row of input.order.rows) {
    const map = input.maps.find((m) => m.label === row.sizeLabel && m.cut === row.cut);
    if (!map) {
      problems.push(`Size ${row.sizeLabel} (${row.cut} cut) has no pattern size in the size map.`);
      continue;
    }
    if (!Object.hasOwn(input.pattern.piecesBySize, map.patternSize)) {
      problems.push(`Size ${row.sizeLabel} (${row.cut} cut) is cut from pattern size ${map.patternSize}, which this pattern does not have.`);
      continue;
    }
    const key = `${row.cut}|${row.sizeLabel}`;
    const found = groups.get(key);
    groups.set(key, found ? { ...found, garments: found.garments + row.quantity } : { sizeLabel: row.sizeLabel, cut: row.cut, patternSize: map.patternSize, garments: row.quantity });
  }
  const bySize: SizeUse[] = [...groups.values()]
    .sort((a, b) => a.cut.localeCompare(b.cut) || a.sizeLabel.localeCompare(b.sizeLabel, "en", { numeric: true }))
    .map((g) => ({
      ...g,
      perGarment: fabricUseForSize(cutList(input.pattern.piecesBySize[g.patternSize] ?? [], { assign: input.assign }), input.widths, efficiency),
    }));
  return { garments: bySize.reduce((s, g) => s + g.garments, 0), fabrics: totals(bySize, input.widths, efficiency), bySize, problems };
}

function totals(bySize: readonly SizeUse[], widths: Readonly<Record<string, FabricWidth>>, efficiency: Efficiency): readonly FabricUse[] {
  const ids = [...new Set(bySize.flatMap((s) => s.perGarment.map((u) => u.fabricId)))].sort();
  return ids.map((fabricId) => {
    const parts = bySize.flatMap((s) => {
      const use = s.perGarment.find((u) => u.fabricId === fabricId);
      return use ? [{ garments: s.garments, use }] : [];
    });
    const first = parts[0]!.use;
    const areaCm2 = parts.reduce((sum, p) => sum + p.use.areaCm2 * p.garments, 0);
    const known = parts.every((p) => p.use.lengthMm !== null);
    return {
      ...first,
      areaCm2,
      efficiency,
      lengthMm: known ? parts.reduce((sum, p) => sum + (p.use.lengthMm as number) * p.garments, 0) : null,
      widthMm: widths[fabricId]?.mm ?? null,
    };
  });
}
