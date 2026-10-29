import { MEN_RUN, syntheticPieces } from "@/lib/pattern-library/fixtures/synthetic-set";
import type { GradedPattern, PatternPiece, Point } from "@/lib/production/contract";
import type { KppInput, KppPom, KppSources } from "../model";
import { Canvas } from "../pdf/canvas";
import { writePdf } from "../pdf/writer";

/**
 * TEST FIXTURE ONLY. The worked base article JSY-SS-01 (docs/spec/articles/JSY-SS-01/article.json),
 * whose values are Knitwright's draft for factory review, not agreed numbers. The colour code,
 * Pantone and swatch are the illustrative ones in docs/spec/04. The pattern is the pattern
 * library's synthetic seven-size run, which is not a real grade.
 */

const SIZES = [...MEN_RUN];

const pom = (letter: string, code: string, description: string, grade: number, tol: number, ruleId: string, m: number, fixed = false): KppPom => ({
  letter,
  code,
  description,
  gradeType: fixed ? "fixed" : "linear",
  gradeMm: grade,
  tolMinusMm: tol,
  tolPlusMm: tol,
  values: Object.fromEntries(SIZES.map((s, i) => [s, m + (i - 2) * grade])),
  ruleId,
  provenance: "from_base",
});

export const JSY_INPUT: KppInput = {
  kind: "sample",
  design: {
    code: "ACME_Home_Kit",
    name: "Home kit 2027",
    articleCode: "JSY-SS-01",
    version: 3,
    hash: "a".repeat(64),
    createdAtIso: "2026-10-25T09:30:00.000Z",
    brand: "Acme FC",
    season: "SS27",
    baseSize: "M",
    sizes: SIZES,
  },
  factory: { code: "SKT-01", name: "Sialkot partner factory", contact: "Knitwright production team, production@example.invalid", notch: "v-notch", printFileType: "pdf", madeByKnitwright: true },
  dueDate: "2026-11-20",
  fields: [
    { id: "style_name", label: "Style name", value: "Home kit 2027", provenance: "from_design", ruleId: "R-GAP-000" },
    { id: "class", label: "Production class", value: "A", provenance: "from_base", ruleId: "R-QC-001" },
    { id: "fabric", label: "Fabric", value: "F-POLY-INT 100% polyester interlock", provenance: "from_base", ruleId: "R-SUB-001" },
  ],
  poms: [
    pom("A", "CH", "Chest width, 25 mm below armhole, half", 30, 10, "R-FIT-001", 520),
    pom("B", "BL", "Body length, front, HPS to hem", 20, 10, "R-FIT-002", 720),
    pom("C", "SW", "Across shoulder, seam to seam", 15, 7, "R-FIT-003", 460),
    pom("D", "SL", "Sleeve length, shoulder point to hem", 10, 7, "R-FIT-004", 210),
    pom("J", "BND", "Back neck drop, HPS to seam", 0, 3, "R-FIT-007", 20, true),
  ],
  bom: [
    { item: "Main fabric", type: "fabric", spec: "F-POLY-INT 100% polyester interlock 140-160 gsm, white, sublimation-ready", supplierRef: null, qtyPerPiece: "0.80", unit: "m", sizeDependent: true, ruleId: "R-SUB-001", provenance: "from_base" },
    { item: "Needle thread", type: "thread", spec: "Poly core-spun Tex 27", supplierRef: null, qtyPerPiece: "60", unit: "m", sizeDependent: false, ruleId: "R-CON-009", provenance: "from_base" },
    { item: "Care label", type: "label", spec: "Printed polyester satin 30 x 60 mm", supplierRef: null, qtyPerPiece: "1", unit: "pc", sizeDependent: false, ruleId: "R-LAB-002", provenance: "from_base" },
  ],
  colour: {
    fabric: "F-POLY-INT",
    tolerance: { metric: "dE_CMC_2_1", max: 1.5 },
    colours: [{ role: "primary", hex: "#0B1F4B", pantoneTcx: "19-4024 TCX", swatchId: "SB-POLY-INT-031" }],
    strikeOffRequired: true,
    ruleId: "R-SUB-005",
  },
  labels: [
    { market: "uk", fibre: "100% Polyester", care: ["Wash 30 C", "Do not bleach", "Do not tumble dry", "Do not iron print", "Do not dry clean"], origin: "Made in Pakistan", size: "See size label", importer: "Acme FC, 1 Example Street, London", importerRequired: true, ruleId: "R-LAB-002" },
    { market: "au", fibre: "100% Polyester", care: ["Warm machine wash", "Do not bleach"], origin: "Made in Pakistan", size: "See size label", importer: null, importerRequired: false, ruleId: "R-LAB-002" },
  ],
  qc: {
    aqlPlan: "Class A: 100% inspection. Runs: AQL 0 critical / 2.5 major / 4.0 minor, level II",
    measure: ["A", "B", "C", "D"],
    colour: "Each colour role against the strike-off, delta E CMC 2:1 <= 1.5",
    visual: ["Print alignment across side and shoulder seams within 3 mm"],
    photos: ["Front", "Back", "Care label", "Side seam close-up", "Print edge close-up"],
    ruleId: "R-QC-001",
  },
  print: { minDpi: 150, minBleedMm: 10, dpi: 150, bleedMm: 10, ruleId: "R-SUB-002" },
  moderation: "clear",
  orders: [],
  personalisation: [],
  packing: [],
  notes: ["No ICC profile for this fabric: print files are left as sRGB."],
};

export const JSY_BATCH: KppInput = {
  ...JSY_INPUT,
  kind: "batch",
  factory: { ...JSY_INPUT.factory, madeByKnitwright: true },
  orders: [
    { orderNo: "KW10422", sizes: { M: 2, XL: 1 }, dueDate: "2026-11-20" },
    { orderNo: "KW10423", sizes: { S: 1 }, dueDate: "2026-11-22" },
  ],
  personalisation: [
    { orderNo: "KW10422", lineId: "L1", size: "M", name: "SMITH", number: "7", nameZone: "back_name", numberZone: "back_number", fontId: "kw-block-01", colourHex: "#FFFFFF" },
    { orderNo: "KW10422", lineId: "L2", size: "M", name: "=JONES", number: "9", nameZone: "back_name", numberZone: "back_number", fontId: "kw-block-01", colourHex: "#FFFFFF" },
  ],
  packing: ["Fold flat and bag each order separately."],
};

/**
 * The pattern library's synthetic pieces carry no sew line and no notch, and docs/spec/04 asks
 * for both in every pattern file. So the fixture adds a sew line 3% inside the cut line about the
 * piece's own middle, and a notch on each of two cut points. NEITHER IS A REAL SEAM ALLOWANCE
 * NOR A REAL NOTCH POSITION: they exist so the writers' sew and notch output is exercised.
 */
function withSeamDetail(piece: PatternPiece): PatternPiece {
  const xs = piece.cutOutline.map((p) => p[0]);
  const ys = piece.cutOutline.map((p) => p[1]);
  const mid: Point = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const inward = (p: Point): Point => [Math.round((mid[0] + (p[0] - mid[0]) * 0.97) * 100) / 100, Math.round((mid[1] + (p[1] - mid[1]) * 0.97) * 100) / 100];
  const at = (i: number) => piece.cutOutline[Math.min(i, piece.cutOutline.length - 1)];
  return {
    ...piece,
    sewLine: piece.cutOutline.map(inward),
    seamAllowance: [{ seamId: "side-seam", mm: 10, source: "knitwright-default" }],
    notches: [
      { seamId: "side-seam", at: at(1), count: 1 },
      { seamId: "shoulder-seam", at: at(Math.floor(piece.cutOutline.length / 2)), count: 2 },
    ],
  };
}

export const JSY_PATTERN: GradedPattern = {
  blockId: "synthetic-jersey",
  blockVersion: 1,
  sizes: SIZES,
  piecesBySize: Object.fromEntries(MEN_RUN.map((s) => [s, syntheticPieces(s).map(withSeamDetail)])),
};

/** A one-page PDF standing in for a print file or the tech pack. */
export function tinyPdf(text: string, createdIso = "2030-01-01T00:00:00.000Z"): Uint8Array {
  const c = new Canvas(100, 100);
  c.text(10, 20, text);
  return writePdf({ title: text, createdIso, pages: [c.page()] });
}

/** Test doubles for every source. `calls` records what the print source was asked. */
export function fixtureSources(overrides: Partial<KppSources> = {}): KppSources & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    pattern: { pattern: async () => JSY_PATTERN },
    print: {
      files: async (size, orderNo) => {
        calls.push(`${orderNo ?? "SAMPLE"}/${size}`);
        return ["front", "back", "sleeve-left", "sleeve-right"].map((panel) => ({ panel, bytes: tinyPdf(`${orderNo ?? "SAMPLE"} ${panel} ${size}`) }));
      },
    },
    techpack: { pdf: async () => tinyPdf("Tech pack", new Date().toISOString()) },
    renders: { frontBack: async () => null },
    ...overrides,
  };
}
