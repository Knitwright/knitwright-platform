import { describe, expect, it } from "vitest";
import { playerSchema, playersFromRows, playersSchema, readRosterCsv, rosterNotes } from "./roster";

const CSV = "Name,Number,Size,Cut\nSam Park,9,M,men\nLee Chen,10,S,women\n";

describe("readRosterCsv", () => {
  it("reads players with their sizes and wearer groups", () => {
    const read = readRosterCsv(CSV);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.players).toEqual([
        { name: "Sam Park", number: "9", sizeLabel: "M", wearerGroup: "mens" },
        { name: "Lee Chen", number: "10", sizeLabel: "S", wearerGroup: "womens" },
      ]);
      expect(read.problems).toEqual([]);
    }
  });

  it("reports a bad line and keeps the good ones", () => {
    const read = readRosterCsv("Name,Number,Size\nSam,9,M\nBad<>,10,S\n");
    expect(read.ok && read.players).toHaveLength(1);
    expect(read.ok && read.problems[0]?.line).toBe(3);
  });

  it("asks for a column mapping when the number or size is missing", () => {
    const read = readRosterCsv("Who,What\nSam,9\n");
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.needsMapping).toBe(true);
  });

  it("neutralises nothing silently: a spreadsheet formula as a name is refused", () => {
    const read = readRosterCsv("Name,Number,Size\n=cmd|' /C calc'!A0,9,M\n");
    expect(read.ok && read.players).toEqual([]);
  });

  it("notes a number used twice", () => {
    const read = readRosterCsv("Name,Number,Size\nA,9,M\nB,9,L\n");
    expect(read.ok && read.notes).toEqual(["Number 9 is used 2 times."]);
  });
});

describe("rosterNotes", () => {
  it("ignores players without a number", () => {
    const p = { name: "", number: "", sizeLabel: "M", wearerGroup: "unisex" } as const;
    expect(rosterNotes([p, p])).toEqual([]);
  });
});

describe("playerSchema", () => {
  it("cleans the name and allows an empty one and an empty number", () => {
    expect(playerSchema.parse({ name: "  Sam   Park ", number: "", sizeLabel: " M ", wearerGroup: "mens" })).toEqual({ name: "Sam Park", number: "", sizeLabel: "M", wearerGroup: "mens" });
    expect(playerSchema.parse({ name: "", number: "07", sizeLabel: "M", wearerGroup: "mens" }).number).toBe("07");
  });

  it.each([
    { name: "x", number: "1000", sizeLabel: "M", wearerGroup: "mens" },
    { name: "x", number: "a", sizeLabel: "M", wearerGroup: "mens" },
    { name: "x", number: "1", sizeLabel: "", wearerGroup: "mens" },
    { name: "x", number: "1", sizeLabel: "M", wearerGroup: "kids" },
    { name: "a".repeat(41), number: "1", sizeLabel: "M", wearerGroup: "mens" },
    { name: "<script>", number: "1", sizeLabel: "M", wearerGroup: "mens" },
  ])("refuses %j", (bad) => {
    expect(playerSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses more than 1000 players", () => {
    const player = { name: "A", number: "1", sizeLabel: "M", wearerGroup: "mens" };
    expect(playersSchema.safeParse(Array.from({ length: 1001 }, () => player)).success).toBe(false);
  });
});

describe("playersFromRows", () => {
  it("maps database columns", () => {
    const id = "6f1c1b0e-6a39-4b0e-8f0e-2b6a1d2f3c4d";
    expect(playersFromRows([{ id, name: "A", number: "1", size_label: "M", wearer_group: "mens" }])).toEqual([{ id, name: "A", number: "1", sizeLabel: "M", wearerGroup: "mens" }]);
    expect(playersFromRows(null)).toEqual([]);
  });
});

describe("readRosterCsv options", () => {
  it("reads a file with no header row, with a chosen mapping and the sizes the design is made in", () => {
    const read = readRosterCsv("Sam,9,xl\n", { header: false, mapping: { name: 0, number: 1, sizeLabel: 2 }, run: ["M", "XL"] });
    expect(read.ok && read.players).toEqual([{ name: "Sam", number: "9", sizeLabel: "XL", wearerGroup: "unisex" }]);
  });

  it("tells the caller which columns it found when it needs a choice", () => {
    const read = readRosterCsv("Who,What\nSam,9\n");
    expect(!read.ok && read.headers).toEqual(["Who", "What"]);
  });
});
