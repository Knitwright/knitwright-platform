import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { colourRows } from "@/lib/projects/colour-controls";
import { artworkRows } from "@/lib/projects/artwork-controls";
import { namesNumbersPanel } from "@/lib/projects/names-numbers-controls";
import { defaultForm } from "./form";
import { jersey } from "./fixtures/article";
import { designSummary, summaryTarget, type SummaryInput } from "./summary";
import { SUMMARY_SECTIONS } from "./slots";

/** The right-hand Design Summary. Its lines are the factory file's own, so the two cannot disagree. */

const input = (patch: Partial<SummaryInput> = {}): SummaryInput => {
  const spec = start("team-jersey");
  return {
    spec,
    article: jersey(),
    form: defaultForm(jersey()),
    colours: colourRows(spec),
    artwork: artworkRows(spec),
    namesNumbers: namesNumbersPanel(spec),
    ...patch,
  };
};

const section = (id: (typeof SUMMARY_SECTIONS)[number]) => designSummary(input()).find((entry) => entry.id === id);

describe("the Design Summary", () => {
  it("has the seven sections of the spec, in its order", () => {
    expect(designSummary(input()).map((entry) => entry.label)).toEqual([
      "Fabrics",
      "Colours",
      "Pattern fills",
      "Graphics",
      "Names & numbers",
      "Trims & labels",
      "Stitches",
    ]);
  });

  it("lists each fabric with the pieces it is on", () => {
    const rows = section("fabrics")?.rows ?? [];

    expect(rows[0]?.label).toBe("Main fabric");
    expect(rows[0]?.detail).toContain("Body front");
  });

  it("says what a section with nothing in it has, rather than leaving it out", () => {
    expect(section("graphics")).toMatchObject({ rows: [], empty: "No crest, sponsor or wording yet." });
    expect(section("names-numbers")?.empty).toBe("Off.");
  });

  it("reads the stitches from the base article's construction table and never lets them be edited", () => {
    const stitches = section("stitches");

    expect(stitches?.readOnly).toBe(true);
    expect(stitches?.opens).toBeNull();
    expect(stitches?.rows.length).toBeGreaterThan(0);
    for (const row of stitches?.rows ?? []) expect(row.ruleId).toMatch(/^R-/);
  });

  it("says which editor every other section opens", () => {
    for (const entry of designSummary(input())) {
      if (entry.id === "stitches") continue;
      expect(entry.opens).not.toBeNull();
      expect(entry.readOnly).toBe(false);
    }
    expect(summaryTarget("colours")).toEqual({ tool: "colours", section: "colours" });
    expect(summaryTarget("stitches")).toBeNull();
  });

  it("says nothing about a pattern fill while the design is plain, and names it once it is not", () => {
    expect(section("pattern-fills")?.rows).toEqual([]);

    const filled = designSummary(input({ form: { options: { pattern_fill: "P01" }, parameters: {} } })).find((entry) => entry.id === "pattern-fills");

    expect(filled?.rows[0]?.label).toBe("P01 Vertical stripes");
    expect(filled?.rows[0]?.ruleId).toBe("R-GAP-000");
  });

  it("holds no stitches and no fill for a design with no base article", () => {
    const none = designSummary(input({ article: null }));

    expect(none.find((entry) => entry.id === "stitches")?.rows).toEqual([]);
    expect(none.find((entry) => entry.id === "pattern-fills")?.rows).toEqual([]);
  });

  it("lists the trims and labels the factory file lists", () => {
    expect((section("trims-labels")?.rows ?? []).length).toBeGreaterThan(0);
  });
});
