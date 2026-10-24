export const CHECKLIST_KEYS = ["measurements", "colour", "artwork", "names_numbers"] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export const CHECKLIST_RESULTS = ["pass", "fail", "not_inspected"] as const;
export type ChecklistResult = (typeof CHECKLIST_RESULTS)[number];

export const CHECKLIST_LABELS: Readonly<Record<ChecklistKey, string>> = {
  measurements: "Measurements against the size spec, on a sample",
  colour: "Colour against the swatch",
  artwork: "Artwork placement",
  names_numbers: "Names and numbers against the team list",
};

export const RESULT_LABELS: Readonly<Record<ChecklistResult, string>> = { pass: "Pass", fail: "Fail", not_inspected: "Not inspected" };

export interface ChecklistItem {
  readonly key: ChecklistKey;
  readonly result: ChecklistResult;
  readonly note: string;
}

/** Every number is typed by the inspector, in millimetres. Nothing here is a default. */
export interface Measurement {
  readonly point: string;
  readonly specMm: number;
  readonly measuredMm: number;
  readonly toleranceMm: number;
}

/** The rule applied to defects. A labelled default: the factory has not agreed an acceptable defect rate (owner question Q2). */
export const DEFECT_RULE_LABEL = "Knitwright default, not agreed with a factory: one defective piece in the sample fails the order.";

/** Millimetres to three places, so 520.1 - 520 is 0.1 and not 0.10000000000002. */
const mm = (n: number): number => Math.round(n * 1000) / 1000;

export const withinTolerance = (m: Measurement): boolean => mm(Math.abs(m.measuredMm - m.specMm)) <= m.toleranceMm;

export interface Evaluation {
  readonly result: "pass" | "fail";
  /** Plain sentences saying why it failed. Empty on a pass. */
  readonly reasons: readonly string[];
}

export interface InspectionInput {
  readonly checklist: readonly ChecklistItem[];
  readonly measurements: readonly Measurement[];
  readonly defectCount: number;
}

/**
 * The result of an inspection, from what was typed. The SQL function `ops_record_inspection` does the same sum and
 * the integration test holds the two to each other: pass only when all four items pass, at least one measurement is
 * recorded and every one is inside its tolerance, and no piece in the sample has a defect.
 */
export function evaluateInspection(input: InspectionInput): Evaluation {
  const reasons: string[] = [];
  for (const key of CHECKLIST_KEYS) {
    const item = input.checklist.find((c) => c.key === key);
    if (!item || item.result === "not_inspected") reasons.push(`${CHECKLIST_LABELS[key]}: not inspected.`);
    else if (item.result === "fail") reasons.push(`${CHECKLIST_LABELS[key]}: fail.`);
  }
  if (input.measurements.length === 0) reasons.push("No measurement was recorded.");
  for (const m of input.measurements.filter((x) => !withinTolerance(x))) {
    reasons.push(`${m.point}: measured ${m.measuredMm} mm, spec ${m.specMm} mm, tolerance ${m.toleranceMm} mm.`);
  }
  if (input.defectCount > 0) reasons.push(`${input.defectCount} defective ${input.defectCount === 1 ? "piece" : "pieces"} in the sample.`);
  return { result: reasons.length === 0 ? "pass" : "fail", reasons };
}
