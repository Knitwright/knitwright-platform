import { describe, expect, it } from "vitest";
import { printScale, readinessItemSchema } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { buildMeasurements } from "../measurements";
import { benchmarkJerseyInput, completeProduction, gradedJersey, matchingMeasured, printReports, TESTED_FABRIC, targetedJersey } from "../fixtures/production";
import { buildOnPattern } from "./measured";
import type { ProductionInput } from "./input";
import { ACTOR_LABELS, buildReadiness, READY_WORDS, type ReadinessContext } from "./readiness";

const TARGETED = targetedJersey();
const TABLE = buildMeasurements(TARGETED);
const SCALE = printScale(TESTED_FABRIC);
const FABRIC = TESTED_FABRIC;
const NO_GAPS = { sections: [], proposed: 0 };

const everything = (): ProductionInput => completeProduction();

const ctx = (input: ProductionInput, extra: Partial<ReadinessContext> = {}): ReadinessContext => ({
  input,
  orderedSizes: ["48"],
  measurements: TABLE,
  onPattern: buildOnPattern(TABLE, input.measured ?? [], input.sizeMap ?? [], input.patternOnlyTargets ?? []),
  completeness: NO_GAPS,
  colours: input.colours ?? [],
  needsRoster: true,
  ...extra,
});

const items = (section: ReturnType<typeof buildReadiness>) => Object.fromEntries(section.groups.flatMap((group) => group.items).map((entry) => [entry.id, entry]));
const open = (section: ReturnType<typeof buildReadiness>) => section.groups.flatMap((group) => group.items).filter((entry) => !entry.met).map((entry) => entry.id);

describe("ready for the factory", () => {
  it("is ready only when every item is met, and then says so in these words", () => {
    const section = buildReadiness(ctx(everything()));
    expect(open(section)).toEqual([]);
    expect(section.ready).toBe(true);
    expect(section.summary).toBe(`${READY_WORDS}.`);
    expect(section.open).toEqual([]);
    expect(section.groups.map((group) => group.id)).toEqual(["pattern", "spec", "fabric", "print", "proof", "order", "release", "components"]);
  });

  it("makes every item a valid readiness item with one sentence", () => {
    for (const input of [everything(), {}]) {
      for (const entry of buildReadiness(ctx(input)).groups.flatMap((group) => group.items)) {
        const { actorLabel, ...record } = entry;
        expect(readinessItemSchema.safeParse(record).success, entry.id).toBe(true);
        expect(actorLabel).toBe(ACTOR_LABELS[entry.whoActs]);
        expect(entry.sentence.split(/\.\s/).length, entry.sentence).toBeLessThanOrEqual(3);
      }
    }
  });

  it("with no pattern and no owner input lists what is missing and who acts, never ready", () => {
    const section = buildReadiness(ctx({}, { onPattern: null }));
    expect(section.ready).toBe(false);
    expect(section.summary).toMatch(/^Not ready for the factory yet: \d+ things are left\.$/);
    expect(items(section)["pattern-present"]).toMatchObject({ met: false, whoActs: "technician", sentence: "A technician adds a pattern: a draft or your own DXF file." });
    expect(items(section)["spec-measured"]?.sentence).toBe("Measurements are taken from the pattern once it is in the library.");
    expect(section.open.map((entry) => entry.whoActs)).toEqual(["owner", "technician", "print-house", "factory", "club"]);
  });

  it("on the benchmark jersey with no owner input lists exactly the owner-input items of the plan, each with who acts", () => {
    const section = buildReadiness(
      ctx({ ...benchmarkJerseyInput(), measured: matchingMeasured(TABLE, ["48"]), seamAgreements: [{ size: "48", seamId: "shoulder", label: "Shoulder", differenceMm: 0.5, statedEaseMm: null }] }, { needsRoster: false }),
    );
    const byId = items(section);
    const expected: Record<string, string> = {
      "pattern-review": "technician", // P1: a technician reviews each block
      "fabric-test": "print-house", // P4: fabric tests
      "fabric-reduction": "technician", // P4: follows from the test
      "fabric-use-basis": "factory", // P9: usable width and marker efficiency
      "print-profile": "print-house", // P5: print house profile
      "print-files": "technician", // made once the fabric and profile are known
      "print-bleed": "technician",
      "print-scale": "technician", // scaled from the fabric test
      "print-marks": "technician",
      "print-colour-codes": "owner", // P6: factory codes are typed
      "league-rules": "club", // P7: league rules
      "proof-strike-off": "owner", // P10: who signs
      "release-frozen": "owner",
    };
    expect(open(section).sort()).toEqual(Object.keys(expected).sort());
    for (const [id, who] of Object.entries(expected)) expect(byId[id]?.whoActs, id).toBe(who);
    expect(byId["pattern-present"]?.met).toBe(true);
    expect(byId["order-roster"]?.sentence).toBe("This design has no player names or numbers, so it needs no team order.");
  });
});

describe("the pattern items", () => {
  const pattern = (input: ProductionInput) => items(buildReadiness(ctx(input)));

  it("name the sizes that have no pattern", () => {
    const input = { ...benchmarkJerseyInput(), sizeMap: [{ label: "48", wearer: "men" as const, cut: "mens" as const, patternSize: "52", source: "suggested" as const }] };
    expect(pattern(input)["pattern-present"]?.sentence).toBe("A technician adds the pattern for size 52.");
    expect(buildReadiness(ctx(benchmarkJerseyInput(), { orderedSizes: [] })).groups[0]?.items[0]?.sentence).toBe("Set the sizes of the design so each can be matched to a pattern size.");
  });

  it("want a review of this version of the block", () => {
    expect(pattern(benchmarkJerseyInput())["pattern-review"]).toMatchObject({ met: false });
    const other = { ...benchmarkJerseyInput(), review: { name: "A", date: "d", dateIso: "2026-01-01", blockVersion: 7, note: null } };
    expect(pattern(other)["pattern-review"]?.met).toBe(false);
    expect(pattern(everything())["pattern-review"]?.sentence).toBe("Reviewed by Ana Reyes on 3 Oct 2026.");
  });

  it("find edges with no stated seam allowance, and a pattern that does not say whether the outline holds it", () => {
    const raw = { pattern: JERSEY_EU48 };
    expect(pattern(raw)["pattern-seam-allowance"]?.sentence).toMatch(/^A technician states the seam allowance on every edge and says whether the outline includes it \(missing on torso front, torso back, sleeve full right and .+\)\.$/);
    expect(pattern({})["pattern-seam-allowance"]?.sentence).toMatch(/adds the pattern/);
    const notStated = benchmarkJerseyInput().pattern!;
    const front = { ...notStated.piecesBySize["48"]![0]!, seamAllowance: [{ seamId: "hem", mm: null, source: "not-stated" as const }] };
    expect(pattern({ pattern: { ...notStated, piecesBySize: { "48": [front] } } })["pattern-seam-allowance"]?.met).toBe(false);
  });

  it("want notches on every joined seam", () => {
    const complete = benchmarkJerseyInput();
    expect(pattern(complete)["pattern-notches"]?.met).toBe(true);
    const stripped = { ...complete.pattern!, piecesBySize: { "48": complete.pattern!.piecesBySize["48"]!.map((piece) => ({ ...piece, notches: [] })) } };
    expect(pattern({ pattern: stripped })["pattern-notches"]?.sentence).toMatch(/^A technician adds notches to every joined seam \(missing on torso front/);
    expect(pattern({})["pattern-notches"]?.sentence).toMatch(/adds the pattern/);
  });

  it("compare the joined seams within 2 mm or the stated ease", () => {
    const seams = (differenceMm: number, statedEaseMm: number | null) => ({ ...benchmarkJerseyInput(), seamAgreements: [{ size: "48", seamId: "armhole", label: "Armhole", differenceMm, statedEaseMm }] });
    expect(pattern(seams(2, null))["pattern-seams-agree"]?.met).toBe(true);
    expect(pattern(seams(-2.5, null))["pattern-seams-agree"]?.sentence).toBe("A technician fixes the seams that differ by more than 2 mm: Armhole at size 48.");
    expect(pattern(seams(5, 5))["pattern-seams-agree"]?.met).toBe(true);
    expect(pattern(seams(8, 5))["pattern-seams-agree"]?.met).toBe(false);
    expect(pattern(benchmarkJerseyInput())["pattern-seams-agree"]?.sentence).toBe("A technician compares the lengths of the joined seams. None has been compared yet.");
  });

  it("want a grain line on every piece", () => {
    const complete = benchmarkJerseyInput();
    const noGrain = { ...complete.pattern!, piecesBySize: { "48": complete.pattern!.piecesBySize["48"]!.map((piece, index) => (index === 0 ? { ...piece, grainLine: null } : piece)) } };
    expect(pattern({ pattern: noGrain })["pattern-grain"]?.sentence).toBe("A technician adds a grain line to torso front.");
    expect(pattern({})["pattern-grain"]?.sentence).toBe("A technician adds the pieces, each with a grain line.");
  });

  it("treat a graded set as present when every ordered size is in it", () => {
    const graded = { pattern: gradedJersey(true) };
    expect(buildReadiness(ctx(graded, { orderedSizes: ["46", "48", "50"] })).groups[0]?.items[0]?.met).toBe(true);
    expect(buildReadiness(ctx(graded, { orderedSizes: ["46", "48", "52"] })).groups[0]?.items[0]?.sentence).toBe("A technician adds the pattern for size 52.");
  });
});

describe("the specification items", () => {
  it("name the measurements with no target, the ones not measured and the ones outside the tolerance", () => {
    const noTargets = buildReadiness(ctx(everything(), { measurements: buildMeasurements(targetedJersey()).groups.length ? { ...TABLE, groups: TABLE.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, tolerance: { status: "to-be-confirmed" as const } })) })) } : TABLE }));
    expect(items(noTargets)["spec-targets"]?.sentence).toMatch(/^Give a target and a tolerance for Chest width/);
    const empty = buildReadiness(ctx(everything(), { measurements: { ...TABLE, groups: [] } }));
    expect(items(empty)["spec-targets"]?.sentence).toBe("Set the sizes and measurements of the design.");

    const partial = buildReadiness(ctx({ ...everything(), measured: matchingMeasured(TABLE, ["48"]).slice(1) }));
    expect(items(partial)["spec-measured"]?.sentence).toBe("1 value has not been measured on the pattern.");

    const off = everything();
    const measured = off.measured!.map((m) => (m.pointId === "chest-width" ? { ...m, tenthsMm: m.tenthsMm + 500 } : m));
    const outside = items(buildReadiness(ctx({ ...off, measured })));
    expect(outside["spec-in-tolerance"]).toMatchObject({ met: false, whoActs: "technician", sentence: "Change the pattern or the target for Chest width: they are outside the tolerance." });
  });
});

describe("the fabric, print, proof, order, release and component items", () => {
  const run = (input: ProductionInput, extra: Partial<ReadinessContext> = {}) => items(buildReadiness(ctx(input, extra)));

  it("want a fabric test for stretch and shrink, and a reduction that matches it", () => {
    expect(run({ ...everything(), fabric: { ...FABRIC, shrinkWidthPct: { value: 1.5, source: "supplier-sheet" } } })["fabric-test"]?.met).toBe(false);
    expect(run({ ...everything(), blockReduction: { lengthPct: 30, widthPct: 45 } })["fabric-reduction"]?.met).toBe(false);
    expect(run({ ...everything(), blockReduction: { lengthPct: 30.4, widthPct: 39.7 } })["fabric-reduction"]?.met).toBe(true);
    expect(run({ ...everything(), blockReduction: null })["fabric-reduction"]?.met).toBe(false);
    expect(run({ ...everything(), fabric: { ...FABRIC, stretchLengthPct: { value: 30, source: "suggested" } } })["fabric-reduction"]?.met).toBe(false);
  });

  it("want the factory's width and marker, not the defaults", () => {
    expect(run({ ...everything(), marker: { efficiencyPct: 80, source: "knitwright-default" } })["fabric-use-basis"]?.met).toBe(false);
    expect(run({ ...everything(), marker: null })["fabric-use-basis"]?.met).toBe(false);
    expect(run({ ...everything(), fabric: { ...FABRIC, usableWidthMm: { value: null, source: "not-set" } } })["fabric-use-basis"]?.met).toBe(false);
  });

  it("want print settings from the print house", () => {
    expect(run({ ...everything(), printProfile: { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" } })["print-profile"]?.met).toBe(false);
  });

  it("want a print file for every piece, size and player", () => {
    const files = everything().printFiles!;
    expect(run({ ...everything(), printFiles: files.slice(1) })["print-files"]?.sentence).toBe("Print files are missing for 1 piece and size.");
    expect(run({ ...everything(), printFiles: files.filter((file) => file.playerNumber !== "10") })["print-files"]?.sentence).toBe("Print files are missing for 1 player.");
    expect(run({ ...everything(), printFiles: [] })["print-files"]?.sentence).toBe("Print files are missing for 4 pieces and sizes.");
    expect(run({ ...everything(), pattern: null })["print-files"]?.sentence).toBe("Print files need a pattern first.");
  });

  it("want at least the bleed of the profile", () => {
    const thin = { ...everything(), printFiles: printReports(10, { x: SCALE.width, y: SCALE.length }, true) };
    expect(run(thin)["print-bleed"]?.sentence).toBe("Make the print files again with at least the bleed of the print settings.");
    expect(run({ ...everything(), printProfile: null })["print-bleed"]?.sentence).toBe("Print files need print settings to take their bleed from.");
  });

  it("want files scaled from the fabric test", () => {
    expect(run({ ...everything(), printFiles: printReports(15, { x: 1, y: 1 }, true) })["print-scale"]?.sentence).toBe("Make the print files again, scaled from the fabric test.");
    expect(run({ ...everything(), fabric: null })["print-scale"]?.sentence).toBe("Print files are not scaled for shrink until the fabric has a shrink test.");
  });

  it("name marks that sit outside their zone or text that is too small", () => {
    const bad = everything().printFiles!.map((file, index) => (index === 0 ? { ...file, markProblems: ["the crest is inside the clear space"] } : index === 1 ? { ...file, minimumsMet: false } : file));
    expect(run({ ...everything(), printFiles: bad })["print-marks"]?.sentence).toBe("Move or resize marks: the crest is inside the clear space and text or lines smaller than the minimum.");
    expect(run({ ...everything(), printFiles: [] })["print-marks"]?.sentence).toBe("Marks cannot be placed until print files are made.");
  });

  it("want a code for every colour, and no colour the print house avoids unless a named person accepted it", () => {
    const coded = everything().colours!;
    expect(run({ ...everything(), colours: [] })["print-colour-codes"]?.sentence).toBe("Add the colours of the design and a factory code for each.");
    expect(run({ ...everything(), colours: coded.map((colour) => ({ ...colour, factoryCode: colour.id === "C2" ? " " : colour.factoryCode })) })["print-colour-codes"]?.sentence).toBe("Type the factory code of C2 (red).");
    const yellow = coded.map((colour) => (colour.id === "C2" ? { ...colour, screenColour: "#FFFF00" } : colour));
    const rules = { ...everything().printRules!, coloursToAvoid: ["#ffff00"] };
    expect(run({ ...everything(), colours: yellow, printRules: rules })["print-avoid-colours"]?.sentence).toBe(
      "Change C2 or name the person who accepts it: the print house lists it as a colour to avoid.",
    );
    const accepted = yellow.map((colour) => (colour.id === "C2" ? { ...colour, avoidAcceptedBy: "Sam Lee" } : colour));
    expect(run({ ...everything(), colours: accepted, printRules: rules })["print-avoid-colours"]?.met).toBe(true);
    expect(run({ ...everything(), colours: [{ ...coded[0]!, screenColour: "not a colour" }], printRules: rules })["print-avoid-colours"]?.met).toBe(true);
  });

  it("say no league rules are set until the club gives them", () => {
    expect(run({ ...everything(), printRules: null })["league-rules"]).toMatchObject({ met: false, whoActs: "club", sentence: "No league rules set: check with the competition." });
  });

  it("want a strike-off accepted by a named person", () => {
    expect(run({ ...everything(), strikeOff: null })["proof-strike-off"]?.sentence).toBe("A named person accepts the strike-off for this release. No strike-off has been recorded.");
    expect(run(everything())["proof-strike-off"]?.sentence).toBe("The strike-off was accepted by Sam Lee on 9 Oct 2026.");
  });

  it("want a valid team order when the design has player marks", () => {
    expect(run({ ...everything(), rosterProblems: null })["order-roster"]?.sentence).toBe("The club gives the team order: each player's name, number and size.");
    expect(run({ ...everything(), rosterProblems: ["number 7 is used twice", "no size for Ola"] })["order-roster"]?.sentence).toBe("The club fixes the team order: number 7 is used twice and no size for Ola.");
    expect(run({ ...everything(), rosterProblems: [] }, { needsRoster: false })["order-roster"]?.met).toBe(true);
    expect(run({ ...everything(), rosterProblems: null }, { needsRoster: false })["order-roster"]?.met).toBe(true);
  });

  it("want a frozen release", () => {
    expect(run({ ...everything(), release: null })["release-frozen"]?.sentence).toBe("Freeze a release so the same files can be made again for a reorder.");
    expect(run(everything())["release-frozen"]?.sentence).toBe("Release R-1 is frozen with 40 files and their hashes.");
  });

  it("count empty components and seams, and what is still only proposed", () => {
    const gaps = { sections: [{ id: "components" as const, title: "Component list", items: [{ sectionId: "components" as const, sectionTitle: "x", label: "a", detail: null, target: "a" }, { sectionId: "construction" as const, sectionTitle: "x", label: "b", detail: null, target: "b" }] }, { id: "labelling" as const, title: "L", items: [{ sectionId: "labelling" as const, sectionTitle: "x", label: "c", detail: null, target: "c" }] }], proposed: 3 };
    const out = run(everything(), { completeness: gaps });
    expect(out["components-filled"]?.sentence).toBe("2 components and seams are still empty.");
    expect(out["components-no-proposals"]?.sentence).toBe("3 parts and stitches are still only proposed by Knitwright.");
    const one = run(everything(), { completeness: { sections: [{ id: "components" as const, title: "C", items: [gaps.sections[0]!.items[0]!] }], proposed: 1 } });
    expect(one["components-filled"]?.sentence).toBe("1 component or seam is still empty.");
    expect(one["components-no-proposals"]?.sentence).toBe("1 part or stitch is still only proposed by Knitwright.");
  });

  it("says one thing is left in the singular", () => {
    const section = buildReadiness(ctx({ ...everything(), release: null }));
    expect(section.summary).toBe("Not ready for the factory yet: 1 thing is left.");
  });
});
