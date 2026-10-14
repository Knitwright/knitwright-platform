import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { completenessReport } from "@/lib/techpack";
import { CHARTS, fullDesign, packFor } from "@/lib/techpack/fixtures/designs";
import { confirmables } from "./tech-pack-confirm";
import {
  DEFAULT_SECTION,
  NAV_SECTIONS,
  fileProgress,
  fileSections,
  parseSection,
  progressOf,
  sectionSearch,
  suggestedValueCount,
  thingsLeftSentence,
} from "./tech-pack-sections";

const starterTee = () => {
  const spec = start("crew-tee", "women");
  const pack = packFor(spec, { charts: CHARTS });
  return { spec, pack, report: completenessReport(pack), items: confirmables(spec, pack) };
};

describe("the sections of the factory file", () => {
  it("lists the sections in the order of the file, with Bill of materials and Sources and notes", () => {
    expect(NAV_SECTIONS.map((section) => section.label)).toEqual([
      "Cover",
      "Flats",
      "Measurements",
      "How to measure",
      "Construction",
      "Bill of materials",
      "Artwork",
      "Labelling",
      "Colourways",
      "Illustrations",
      "Patterns",
      "Sources and notes",
      "Request a quote",
    ]);
  });

  it("leaves out the illustrations when there are none", () => {
    const { report, items } = starterTee();
    const ids = fileSections(report, items, { illustrations: false }).map((section) => section.id);
    expect(ids).not.toContain("illustrations");
    expect(fileSections(report, items, { illustrations: true }).map((section) => section.id)).toContain("illustrations");
  });

  it("counts, for each section, the empty fields and the suggestions still to be made your own", () => {
    const { report, items } = starterTee();
    const sections = fileSections(report, items, { illustrations: false });
    const byId = new Map(sections.map((section) => [section.id, section.left]));
    const empty = (id: string) => report.sections.find((section) => section.id === id)?.items.length ?? 0;
    const suggested = (id: string) => items.filter((item) => item.sectionId === id).length;

    expect(byId.get("measurements")).toBe(empty("measurements") + suggested("measurements"));
    expect(byId.get("measurements")).toBeGreaterThan(0);
    expect(byId.get("construction")).toBe(empty("construction") + suggested("construction"));
    expect(byId.get("components")).toBe(empty("components") + suggested("components"));
    expect(byId.get("flats")).toBe(0);
    expect(byId.get("patterns")).toBe(0);
    const total = sections.reduce((sum, section) => sum + section.left, 0);
    expect(total).toBe(report.total + items.length);
  });

  it("says how many things are left in plain words", () => {
    expect(thingsLeftSentence(0)).toBe("Nothing left to fill in or make your own");
    expect(thingsLeftSentence(1)).toBe("1 thing left to fill in or make your own");
    expect(thingsLeftSentence(9)).toBe("9 things left to fill in or make your own");
  });
});

describe("how much of the file is settled", () => {
  it("counts a value as settled when it is yours or worked out, not when it is suggested, proposed or empty", () => {
    const { pack } = starterTee();
    const progress = fileProgress(pack);
    expect(progress.total).toBeGreaterThan(0);
    expect(progress.settled).toBeLessThan(progress.total);
    expect(progress.percent).toBe(Math.floor((progress.settled / progress.total) * 100));
  });

  it("rises when a design is filled in", () => {
    const before = fileProgress(starterTee().pack).percent;
    const after = fileProgress(packFor(fullDesign("crew-tee"), { charts: CHARTS })).percent;
    expect(after).toBeGreaterThan(before);
  });

  it("never reaches 100 while one value is left, and is 100 for no values", () => {
    const yours = { status: "set", value: "1", provenance: "user-edited" };
    const many = [...Array.from({ length: 199 }, () => yours), { status: "to-be-confirmed" }];
    expect(progressOf(many).percent).toBe(99);
    expect(progressOf([]).percent).toBe(100);
    expect(progressOf([{ ...yours, provenance: "derived" }]).percent).toBe(100);
    expect(progressOf([{ ...yours, provenance: "suggested-chart" }]).percent).toBe(0);
    expect(progressOf([{ ...yours, provenance: "derived", proposal: true }]).percent).toBe(0);
  });
});

describe("the section in the address", () => {
  const available = ["cover", "measurements", "patterns", "left"] as const;

  it("reads a known section", () => {
    expect(parseSection("measurements", available)).toBe("measurements");
    expect(parseSection(["patterns", "cover"], available)).toBe("patterns");
    expect(parseSection("left", available)).toBe("left");
  });

  it("falls back to the cover for a missing, unknown or unavailable section", () => {
    expect(DEFAULT_SECTION).toBe("cover");
    expect(parseSection(undefined, available)).toBe("cover");
    expect(parseSection("", available)).toBe("cover");
    expect(parseSection("nonsense", available)).toBe("cover");
    expect(parseSection("illustrations", available)).toBe("cover");
    expect(parseSection("MEASUREMENTS", available)).toBe("cover");
  });

  it("writes the address of a section, keeping the other parts of it", () => {
    expect(sectionSearch("", "measurements")).toBe("?section=measurements");
    expect(sectionSearch("?colourway=away", "patterns")).toBe("?colourway=away&section=patterns");
    expect(sectionSearch("?section=cover&colourway=away", "flats")).toBe("?section=flats&colourway=away");
  });
});

describe("accepting every suggestion", () => {
  it("counts each value it sets: every size of a measurement and its tolerance count one each", () => {
    const { items } = starterTee();
    const count = suggestedValueCount(items);
    const measurements = items.filter((item) => item.target.kind === "measurement");
    expect(measurements.length).toBeGreaterThan(0);
    expect(count).toBeGreaterThan(items.length);
  });

  it("counts one for each thing that is not a measurement", () => {
    expect(
      suggestedValueCount([
        { key: "a", sectionId: "construction", label: "", source: "", target: { kind: "construction", seamId: "hem" } },
        {
          key: "b",
          sectionId: "measurements",
          label: "",
          source: "",
          target: { kind: "measurement", pointId: "chest", values: [{ size: null, tenthsMm: 5000 }, { size: "L", tenthsMm: 5200 }], tolerance: 10 },
        },
        { key: "c", sectionId: "measurements", label: "", source: "", target: { kind: "measurement", pointId: "hem", values: [], tolerance: 10 } },
      ]),
    ).toBe(5);
  });
});
