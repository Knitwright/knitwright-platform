import { describe, expect, it } from "vitest";
import type { PrintProfile, PrintRuleSet, PrintZone } from "@/lib/production/contract";
import { JERSEY_EU48, POLKA_JERSEY_DESIGN } from "@/lib/production/fixtures";
import { buildColourways } from "../colourways";
import { fullDesign } from "../fixtures/designs";
import { benchmarkJerseyInput, POLKA_COLOURS, printReports } from "../fixtures/production";
import { buildArtworkAndColour, coloursFromColourways, NO_LEAGUE_RULES } from "./artwork-colour";
import type { ProductionInput } from "./input";

const colourways = buildColourways(fullDesign("polo"));
const zone = (purpose: PrintZone["purpose"], pieceId: string, polygon: [number, number][], clearSpaceMm = 10): PrintZone => ({
  id: `${purpose}-zone`,
  pieceId,
  purpose,
  polygonBySize: { "48": polygon },
  clearSpaceMm,
});
const ZONES: PrintZone[] = [
  zone("front-number", "front", [[40, 10], [100, 10], [100, 110], [40, 110]]),
  zone("back-number", "back", [[40, 200], [100, 200], [100, 260], [40, 260]], 15),
  zone("sleeve-badge", "sleeve", [[-120, 150], [-80, 150], [-80, 222.06], [-120, 222.06]]),
];
const PROFILE: PrintProfile = { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" };
const section = (input: ProductionInput = {}) => buildArtworkAndColour(input, colourways);

describe("the colour standards", () => {
  it("are taken from the colourways when nobody gave the colours a role, one for each distinct colour", () => {
    const found = coloursFromColourways(colourways);
    expect(found.map((colour) => colour.id)).toEqual(found.map((_, index) => `C${index + 1}`));
    expect(found.length).toBeGreaterThan(1);
    expect(found.every((colour) => colour.role.length > 0)).toBe(true);
    expect(found.some((colour) => colour.screenColour === "#1b2a49" && colour.factoryCode === "Navy 19-4052")).toBe(true);
    expect(found.find((colour) => colour.screenColour === "#aa0000")?.name).toBe("Colour not named");
    expect(found.find((colour) => colour.screenColour === "#aa0000")?.factoryCode).toBeNull();
  });

  it("list C1 to C4 with a role, and leave a factory code nobody typed to be confirmed", () => {
    const rows = section({ colours: POLKA_COLOURS }).colours;
    expect(rows.map((row) => [row.id, row.role])).toEqual([["C1", "base"], ["C2", "dot-row-a"], ["C3", "dot-row-b"], ["C4", "trim-and-number"]]);
    expect(rows.every((row) => row.factoryCode.status === "to-be-confirmed" && row.screenColour.status === "to-be-confirmed")).toBe(true);
    expect(section({ colours: POLKA_COLOURS }).note).toBe("4 colours have no factory code yet.");
  });

  it("keep a factory code and a screen colour apart, and say what each is", () => {
    const out = section({ colours: [{ id: "C1", role: "base", name: "White", factoryCode: "PMS 11-0601", screenColour: "#ffffff", avoidAcceptedBy: null }] });
    expect(out.colours[0]).toMatchObject({ factoryCode: { value: "PMS 11-0601" }, screenColour: { value: "#ffffff" } });
    expect(out.note).toBeNull();
    expect(out.colourNote).toContain("Knitwright ships no Pantone data");
  });
});

describe("the zones and where they sit on each size", () => {
  const input: ProductionInput = { ...benchmarkJerseyInput(), zones: ZONES };

  it("list every zone with its piece and clear space", () => {
    const zones = section(input).zones;
    expect(zones.map((row) => [row.purpose, row.pieceName, row.clearSpace])).toEqual([
      ["Front number", "torso front", expect.objectContaining({ value: "1.0" })],
      ["Back number", "torso back", expect.objectContaining({ value: "1.5" })],
      ["Sleeve badge", "sleeve full right", expect.objectContaining({ value: "1.0" })],
    ]);
    expect(zones[0]?.sizes).toBe("48");
  });

  it("measure the placement from the high point of shoulder and the centre line of the piece", () => {
    const [front, back, sleeve] = section(input).placements;
    expect(front).toMatchObject({ size: "48", zone: "Front number", down: { value: "14.5", provenance: "measured-from-pattern" }, across: { value: "6.0" } });
    expect(back).toMatchObject({ zone: "Back number", down: { value: "17.1" }, across: { value: "3.0" } });
    expect(sleeve).toMatchObject({ zone: "Sleeve badge", down: { value: "1.5" }, across: { value: "0.0" } });
  });

  it("leave a placement to be confirmed when there is no pattern, no such piece, or no landmark", () => {
    const none = section({ zones: ZONES }).placements;
    expect(none.every((row) => row.down.status === "to-be-confirmed" && row.across.status === "to-be-confirmed")).toBe(true);
    const missing = section({ ...input, zones: [zone("crest", "no-such-piece", [[0, 0], [1, 0], [1, 1]])] });
    expect(missing.placements[0]).toMatchObject({ pieceName: "no-such-piece", down: { status: "to-be-confirmed" } });
    const collar = section({ ...input, zones: [zone("crest", "collar", [[0, 0], [1, 0], [1, 1]])] });
    expect(collar.placements[0]?.down.status).toBe("to-be-confirmed");
    const noPolygon = section({ ...input, zones: [{ ...ZONES[0]!, polygonBySize: { "48": [] as never } }] });
    expect(noPolygon.placements[0]?.down.status).toBe("to-be-confirmed");
    const noHps = { ...JERSEY_EU48.piecesBySize["48"]![0]!, landmarks: { "cf-neck": [0, 0] as [number, number], hps: [1, 1] as [number, number] } };
    const stripped = section({ pattern: { ...JERSEY_EU48, piecesBySize: { "48": [noHps] } }, zones: [ZONES[0]!] });
    expect(stripped.placements[0]?.down.status).toBe("set");
  });
});

describe("the print rules and print settings", () => {
  const rules = (override: Partial<PrintRuleSet> = {}): PrintRuleSet => ({ minTextHeightMm: null, minLineMm: null, coloursToAvoid: [], numberRules: null, ...override });
  const text = (input: ProductionInput, label: string) => section(input).printRules.find((row) => row.label === label)?.text;

  it("say what is not known: no settings, an empty avoid list, no league rules", () => {
    expect(text({}, "Print settings")).toEqual({ status: "to-be-confirmed" });
    expect(text({}, "Smallest text height")).toEqual({ status: "to-be-confirmed" });
    expect(text({}, "Colours to avoid")).toMatchObject({ value: "The print house has listed no colours to avoid. The list is empty." });
    expect(text({}, "League number rules")).toMatchObject({ value: NO_LEAGUE_RULES });
  });

  it("show the settings and say whether they are the print house's or a Knitwright default", () => {
    expect(text({ printProfile: PROFILE }, "Print settings")).toMatchObject({
      value: "150 dpi, 1.5 cm bleed. Knitwright default, not from your print house.",
      provenance: "derived",
    });
    expect(text({ printProfile: { ...PROFILE, source: "print-house" } }, "Print settings")).toMatchObject({
      value: "150 dpi, 1.5 cm bleed. From your print house.",
      provenance: "user-edited",
    });
  });

  it("show the minimums, the colours to avoid and the league's number rules", () => {
    const set = rules({
      minTextHeightMm: 40,
      minLineMm: 1,
      coloursToAvoid: ["#ffff00", "#00ff00"],
      numberRules: { minHeightMm: 100, maxHeightMm: 250, allowedDigits: null, source: "League rule 4.2" },
    });
    expect(text({ printRules: set }, "Smallest text height")).toMatchObject({ value: "4.0 cm" });
    expect(text({ printRules: set }, "Thinnest line")).toMatchObject({ value: "0.1 cm" });
    expect(text({ printRules: set }, "Colours to avoid")).toMatchObject({ value: "#ffff00, #00ff00" });
    expect(text({ printRules: set }, "League number rules")).toMatchObject({ value: "Numbers 10.0 to 25.0 cm high. League rule 4.2" });
  });

  it("list the settings each print file was made with, and count the players' files", () => {
    const out = section({ ...benchmarkJerseyInput(), printProfile: PROFILE, printFiles: printReports(15, { x: 1.0152, y: 1.0204 }, true) });
    expect(out.printParameters).toHaveLength(4);
    expect(out.printParameters[0]).toMatchObject({
      pieceName: "torso front",
      size: "48",
      player: "Whole team",
      bleed: { value: "1.5" },
      scaleAcross: { value: "1.0152", unit: "times" },
      scaleDown: { value: "1.0204" },
    });
    expect(out.printParametersNote).toBe(
      "26 print files were made at 1:1 with the bleed and scale listed. 22 players have their own files, made with the same bleed and scale. Knitwright default, not from your print house.",
    );
  });

  it("say when there are no files, and when a file is not scaled for shrink", () => {
    expect(section({}).printParametersNote).toBe("No print files have been made yet, so there are no print settings to list.");
    const unscaled = section({ ...benchmarkJerseyInput(), printFiles: printReports(15, { x: 1, y: 1 }, false) });
    expect(unscaled.printParametersNote).toBe("4 print files were made at 1:1 with the bleed and scale listed. Some files are not scaled for shrink.");
    expect(section({ printFiles: printReports(15, { x: 1, y: 1 }, false).slice(0, 1) }).printParametersNote).toMatch(/^1 print file was made/);
  });
});

describe("the repeat", () => {
  const repeat = POLKA_JERSEY_DESIGN.kitPattern;

  it("lists the benchmark dots: 3 cm dots, 7 cm pitch, 3.5 cm rows, half drop", () => {
    const block = section({ repeat }).repeat;
    expect(block?.lengths.map((row) => [row.label, row.measure])).toEqual([
      ["Dot size across", expect.objectContaining({ value: "3.0" })],
      ["Pitch, centre to centre along a row", expect.objectContaining({ value: "7.0" })],
      ["Row step", expect.objectContaining({ value: "3.5" })],
      ["Clear space around marks", expect.objectContaining({ value: "1.0" })],
    ]);
    expect(block?.settings.map((row) => row.setting)).toEqual([
      expect.objectContaining({ value: "Dots" }),
      expect.objectContaining({ value: "Dropped by half a pitch" }),
      expect.objectContaining({ value: "red" }),
      expect.objectContaining({ value: "royal-blue" }),
    ]);
    expect(block?.ok).toBe(true);
    expect(block?.gap).toMatchObject({ value: "1.9" });
    expect(block?.checks).toEqual(["The closest two dots are 1.9 cm apart, edge to edge."]);
  });

  it("is absent without a repeat", () => {
    expect(section({}).repeat).toBeNull();
  });

  it("finds dots that touch, and bad numbers", () => {
    expect(section({ repeat: { ...repeat, diameterMm: 80 } }).repeat).toMatchObject({ ok: false, checks: expect.arrayContaining(["Dots touch or overlap: widen the pitch or the row step."]) });
    expect(section({ repeat: { ...repeat, diameterMm: 0 } }).repeat?.checks).toContain("A dot has no size.");
    expect(section({ repeat: { ...repeat, pitchMm: 0 } }).repeat?.checks).toContain("The pitch and the row step must each be more than zero.");
    expect(section({ repeat: { ...repeat, clearSpaceMm: -1 } }).repeat?.checks).toContain("The clear space cannot be less than zero.");
  });

  it("reads rows in line as one row step apart, and a half drop as the closest of three distances", () => {
    expect(section({ repeat: { ...repeat, halfDrop: false, rowStepMm: 40 } }).repeat?.gap).toMatchObject({ value: "1.0" });
    expect(section({ repeat: { ...repeat, rowStepMm: 20 } }).repeat?.gap).toMatchObject({ value: "1.0" });
  });
});
