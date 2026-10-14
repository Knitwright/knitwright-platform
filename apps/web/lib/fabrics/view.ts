import type { FabricValue } from "@/lib/production/contract";
import { describePrintScale, printScaleFor } from "./print-scale";
import { profileWithTests } from "./profile";
import type { StoredFabric } from "./rows";

/** Plain words for where a fabric number came from. There is no "verified". */
export const FABRIC_SOURCE_LABELS: Readonly<Record<FabricValue["source"], string>> = {
  "fabric-test": "From a fabric test",
  "supplier-sheet": "From the supplier's sheet",
  suggested: "Suggested, not measured",
  "not-set": "Not set",
};

export type FabricValueRow = Readonly<{ id: string; label: string; value: string; source: string; testedOn: string | null }>;

export type FabricView = Readonly<{
  id: string;
  name: string;
  detail: string;
  values: readonly FabricValueRow[];
  printScale: string;
  testCount: number;
  tests: readonly Readonly<{ id: string; line: string; photos: number }>[];
}>;

const ROWS = [
  ["stretchLengthPct", "Stretch along the length", "%"],
  ["stretchWidthPct", "Stretch across the width", "%"],
  ["recoveryPct", "Recovery after stretching", "%"],
  ["shrinkLengthPct", "Shrink along the length after pressing", "%"],
  ["shrinkWidthPct", "Shrink across the width after pressing", "%"],
  ["gsm", "Weight", " gsm"],
  ["usableWidthMm", "Usable width", " cm"],
] as const;

const shown = (field: string, v: FabricValue): string => {
  if (v.value === null) return "Not set";
  const n = field === "usableWidthMm" ? v.value / 10 : v.value;
  return `${Math.round(n * 100) / 100}${ROWS.find((r) => r[0] === field)?.[2] ?? ""}`;
};

const measured = (t: StoredFabric["tests"][number]): string => {
  const parts = [
    t.stretchLengthPct !== null || t.stretchWidthPct !== null ? `stretch ${t.stretchLengthPct ?? "-"} / ${t.stretchWidthPct ?? "-"} % at ${t.loadNewtons} N` : null,
    t.recoveryPct !== null ? `recovery ${t.recoveryPct} %` : null,
    t.shrinkLengthPct !== null || t.shrinkWidthPct !== null ? `shrink ${t.shrinkLengthPct ?? "-"} / ${t.shrinkWidthPct ?? "-"} % after ${t.pressSeconds} s at ${t.pressTempC} °C` : null,
    t.reductionPct !== null ? `stretch reduction ${t.reductionPct} %` : null,
  ];
  return parts.filter((p) => p !== null).join("; ");
};

/** Everything the fabric library shows for one fabric, in plain words. */
export function fabricView(fabric: StoredFabric): FabricView {
  const { profile } = profileWithTests(fabric.sheet, fabric.tests);
  const testedOn = (v: FabricValue): string | null => (v.testId ? (fabric.tests.find((t) => t.id === v.testId)?.testedOn ?? null) : null);
  return {
    id: fabric.id,
    name: fabric.name,
    detail: [fabric.composition, fabric.construction].filter(Boolean).join(", "),
    values: ROWS.map(([id, label]) => ({
      id,
      label,
      value: shown(id, profile[id]),
      source: FABRIC_SOURCE_LABELS[profile[id].source],
      testedOn: testedOn(profile[id]),
    })),
    printScale: describePrintScale(printScaleFor(profile)),
    testCount: fabric.tests.length,
    tests: [...fabric.tests]
      .sort((a, b) => b.testedOn.localeCompare(a.testedOn) || b.id.localeCompare(a.id))
      .map((t) => ({ id: t.id, line: `${t.testedOn}, ${t.testedBy}: ${measured(t)}. ${t.method}`, photos: t.photoFileIds.length })),
  };
}
