/**
 * Test support for tech pack v2. The pieces are the W0 benchmark fixtures. The measurements are read
 * from their landmarks the way the W0 fixture tests read them. In phase B the pattern library's own
 * measure functions replace `measureBenchmark`; nothing here is a measurement of a real garment.
 */
import { applyAction, pointsOfMeasureFor, type GarmentSpec } from "@/lib/garment";
import { madeUpForType } from "@/lib/flat/fixtures/designs";
import { start } from "@/lib/garment/fixtures/specs";
import { printScale, type FabricProfile, type GradedPattern, type PatternMeasurement, type PatternPiece, type Point } from "@/lib/production/contract";
import { JERSEY_EU48, POLKA_JERSEY_DESIGN, ROSTER_22 } from "@/lib/production/fixtures";
import { buildMeasurements } from "../measurements";
import type { MeasurementsSection } from "../types";
import type { ProductionInput, PrintFileReport } from "../production/input";

const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

const lm = (piece: PatternPiece | undefined, id: keyof PatternPiece["landmarks"]): Point => {
  const point = piece?.landmarks[id];
  if (!point) throw new Error(`no landmark ${id}`);
  return point;
};

/** A garment is measured to the nearest millimetre, as a factory would, then stored as tenths of a millimetre. */
const tenths = (mm: number): number => Math.round(mm) * 10;

/** The points of the benchmark that the W0 fixture tests read, for one pattern size. */
export function measureBenchmark(set: GradedPattern, size: string): PatternMeasurement[] {
  const pieces = set.piecesBySize[size] ?? [];
  const front = pieces.find((p) => p.id === "front");
  const back = pieces.find((p) => p.id === "back");
  const sleeve = pieces.find((p) => p.id === "sleeve");
  const read = (pointId: string, mm: number, method: string): PatternMeasurement => ({
    pointId,
    size,
    tenthsMm: tenths(mm),
    source: "measured-from-pattern",
    method,
  });
  return [
    read("chest-width", lm(front, "underarm")[1] * 2, "Twice the distance from the centre front to the underarm point of the front piece."),
    read("body-length", lm(front, "hps")[0] - lm(front, "cf-hem")[0], "From the high point of shoulder to the hem on the centre front."),
    read("hem-width", lm(front, "side-hem")[1] * 2, "Twice the distance from the centre front to the side seam at the hem."),
    read("sleeve-length", lm(sleeve, "cap-top")[0] - lm(sleeve, "hem-a")[0], "From the top of the sleeve cap to the hem."),
    read("upper-arm", dist(lm(sleeve, "underarm-a"), lm(sleeve, "underarm-b")) / 2, "Half the width of the sleeve at the underarm."),
    read("sleeve-opening", dist(lm(sleeve, "hem-a"), lm(sleeve, "hem-b")) / 2, "Half the width of the sleeve at the hem."),
    read("neck-width", lm(front, "hps")[1] * 2, "Twice the distance from the centre front to the high point of shoulder."),
    read("front-neck-drop", lm(front, "hps")[0] - lm(front, "cf-neck")[0], "From the high point of shoulder down to the front neck on the centre front."),
    read("back-neck-drop", lm(back, "hps")[0] - lm(back, "cb-neck")[0], "From the high point of shoulder down to the back neck on the centre back."),
    read("cap-height", lm(sleeve, "cap-top")[0] - lm(sleeve, "underarm-a")[0], "From the top of the sleeve cap down to the underarm line."),
  ];
}

const SEAMS: Readonly<Record<string, readonly string[]>> = {
  front: ["shoulder", "side-seam", "armhole", "neck", "hem"],
  back: ["shoulder", "side-seam", "armhole", "neck", "hem"],
  sleeve: ["armhole", "sleeve-hem"],
  collar: ["neck"],
};

const JOINED = new Set(["shoulder", "side-seam", "armhole", "neck"]);

/** A benchmark piece made complete: seam allowance on every edge and notches on every joined seam. */
export function completePiece(piece: PatternPiece): PatternPiece {
  const seams = SEAMS[piece.id] ?? [];
  const at = piece.cutOutline[0] ?? ([0, 0] as Point);
  return {
    ...piece,
    outlineKind: "without-seam-allowance",
    seamAllowance: seams.map((seamId) => ({ seamId, mm: seamId.endsWith("hem") ? 20 : 6, source: "knitwright-default" as const })),
    notches: seams.filter((seamId) => JOINED.has(seamId)).map((seamId) => ({ seamId, at, count: 1 })),
  };
}

const scaled = (piece: PatternPiece, factor: number, size: string): PatternPiece => ({
  ...piece,
  sizeLabel: size,
  cutOutline: piece.cutOutline.map(([x, y]) => [x * factor, y * factor]),
});

/** The jersey at three sizes, made by scaling size 48. It is for structure tests, not for measurement claims. */
export function gradedJersey(complete: boolean): GradedPattern {
  const base = JERSEY_EU48.piecesBySize["48"] ?? [];
  const sizes = [["46", 0.96], ["48", 1], ["50", 1.04]] as const;
  const withSeams = (piece: PatternPiece) => (complete ? completePiece(piece) : piece);
  return {
    ...JERSEY_EU48,
    sizes: sizes.map(([size]) => size),
    piecesBySize: Object.fromEntries(sizes.map(([size, factor]) => [size, base.map((piece) => withSeams(scaled(piece, factor, size)))])),
  };
}

/** The jersey design with the benchmark PDF's own targets typed in, so the four disagreements show up. */
export function jerseyWithBenchmarkTargets(): GarmentSpec {
  const tolerance = (pointId: string, value: number) => ({ type: "set-tolerance" as const, entry: { pointId, value, provenance: "user-edited" as const } });
  const measure = (pointId: string, value: number) => ({ type: "set-measurement" as const, pointId, value, provenance: "user-edited" as const });
  const actions = [
    { type: "set-sizing" as const, sizing: { sizes: ["48"], baseSize: "48" } },
    measure("chest-width", 5050),
    measure("hem-width", 5050),
    measure("sleeve-length", 2160),
    measure("upper-arm", 1930),
    tolerance("chest-width", 100),
    tolerance("hem-width", 100),
    tolerance("sleeve-length", 50),
    tolerance("upper-arm", 50),
  ];
  return actions.reduce<GarmentSpec>((spec, action) => {
    const result = applyAction(spec, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, start("team-jersey", "men"));
}

/** A print file report for every piece of the 48 jersey and for each player of the roster, all inside their zones. */
export function printReports(bleedMm: number, scale: { x: number; y: number }, withPlayers: boolean): PrintFileReport[] {
  const pieces = JERSEY_EU48.piecesBySize["48"] ?? [];
  const team = pieces.map((piece) => ({ pieceId: piece.id, size: "48", bleedMm, scaleX: scale.x, scaleY: scale.y, markProblems: [], minimumsMet: true }));
  const players = withPlayers
    ? ROSTER_22.rows.map((row) => ({ pieceId: "back", size: "48", playerNumber: row.number, bleedMm, scaleX: scale.x, scaleY: scale.y, markProblems: [], minimumsMet: true }))
    : [];
  return [...team, ...players];
}

/** Colour standards of the polka-dot jersey, with no factory codes typed. */
export const POLKA_COLOURS = POLKA_JERSEY_DESIGN.colours.map((colour) => ({
  id: colour.id,
  role: colour.role,
  name: colour.name,
  factoryCode: null,
  screenColour: null,
  avoidAcceptedBy: null,
}));

/** What the production services would give for the benchmark jersey, built from the W0 fixtures, with no owner input. */
export function benchmarkJerseyInput(): ProductionInput {
  const pattern = JERSEY_EU48;
  return {
    pattern: { ...pattern, piecesBySize: { "48": (pattern.piecesBySize["48"] ?? []).map(completePiece) } },
    measured: measureBenchmark(JERSEY_EU48, "48"),
    colours: POLKA_COLOURS,
    technique: "sublimation",
  };
}

/** The jersey with a made-up target and a 1.0 cm tolerance typed for every point of measure, for one size, 48. */
export function targetedJersey(): GarmentSpec {
  const base = start("team-jersey", "men");
  const values = madeUpForType("team-jersey", {});
  const actions = [
    { type: "set-sizing" as const, sizing: { sizes: ["48"], baseSize: "48" } },
    ...pointsOfMeasureFor(base).flatMap((point) => [
      { type: "set-measurement" as const, pointId: point.id, value: values[point.id] ?? 1000, provenance: "user-edited" as const },
      { type: "set-tolerance" as const, entry: { pointId: point.id, value: 100, provenance: "user-edited" as const } },
    ]),
  ];
  return actions.reduce<GarmentSpec>((spec, action) => {
    const result = applyAction(spec, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, base);
}

/** A measurement on the pattern equal to the target, for every point and size of a table. Only for testing the logic of the list. */
export function matchingMeasured(table: MeasurementsSection, sizes: readonly string[]): PatternMeasurement[] {
  return table.groups.flatMap((group) =>
    group.rows.flatMap((row) =>
      row.values.flatMap((cell, index) => {
        const size = table.columns[index]?.size;
        return cell.status === "set" && size !== null && size !== undefined && sizes.includes(size)
          ? [{ pointId: row.pointId, size, tenthsMm: cell.tenthsMm, source: "measured-from-pattern" as const, method: "Equal to the target, for a test." }]
          : [];
      }),
    ),
  );
}

const TESTED = (value: number) => ({ value, source: "fabric-test" as const, testId: "T-1" });
const NOT_SET = { value: null, source: "not-set" as const };

/** A fabric with every value from a fabric test or a supplier's sheet. */
export const TESTED_FABRIC: FabricProfile = {
  stretchLengthPct: TESTED(30),
  stretchWidthPct: TESTED(40),
  recoveryPct: TESTED(95),
  shrinkLengthPct: TESTED(2),
  shrinkWidthPct: TESTED(1.5),
  gsm: TESTED(180),
  usableWidthMm: { value: 1500, source: "supplier-sheet" },
};

export const UNTESTED_FABRIC: FabricProfile = { ...TESTED_FABRIC, stretchLengthPct: NOT_SET, shrinkLengthPct: NOT_SET };

/** Every record the production services could give for the targeted jersey: nothing is missing. */
export function completeProduction(): ProductionInput {
  const scale = printScale(TESTED_FABRIC);
  return {
    ...benchmarkJerseyInput(),
    measured: matchingMeasured(buildMeasurements(targetedJersey()), ["48"]),
    review: { name: "Ana Reyes", date: "3 Oct 2026", dateIso: "2026-10-03", blockVersion: 1, note: null },
    seamAgreements: [{ size: "48", seamId: "side-seam", label: "Side seam", differenceMm: 1.2, statedEaseMm: null }],
    fabric: TESTED_FABRIC,
    blockReduction: { lengthPct: 30, widthPct: 40 },
    marker: { efficiencyPct: 85, source: "factory" },
    printProfile: { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "print-house" },
    printRules: { minTextHeightMm: 40, minLineMm: 1, coloursToAvoid: [], numberRules: { minHeightMm: 100, maxHeightMm: 250, allowedDigits: null, source: "League rule" } },
    printFiles: printReports(15, { x: scale.width, y: scale.length }, true),
    zones: [
      { id: "front-number-zone", pieceId: "front", purpose: "front-number", polygonBySize: { "48": [[40, 10], [100, 10], [100, 110], [40, 110]] }, clearSpaceMm: 10 },
      { id: "back-number-zone", pieceId: "back", purpose: "back-number", polygonBySize: { "48": [[40, 200], [100, 200], [100, 260], [40, 260]] }, clearSpaceMm: 15 },
    ],
    repeat: POLKA_JERSEY_DESIGN.kitPattern,
    colours: POLKA_COLOURS.map((colour) => ({ ...colour, factoryCode: `Code ${colour.id}`, screenColour: "#c8102e" })),
    signOffs: [{ role: "pattern", name: "Ana Reyes", date: "3 Oct 2026", dateIso: "2026-10-03" }],
    strikeOff: { releaseId: "R-1", name: "Sam Lee", date: "9 Oct 2026", dateIso: "2026-10-09", result: "Shrink 2.0 % and the colours matched" },
    rosterProblems: [],
    rosterPlayers: ROSTER_22.rows.map((row) => ({ number: row.number, size: "48" })),
    release: { id: "R-1", files: 40, createdOn: "10 Oct 2026" },
  };
}
