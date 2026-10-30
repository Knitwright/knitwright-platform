import { describe, expect, it } from "vitest";
import type { OptionDef, ParameterDef } from "@/lib/catalogue";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { artworkRows } from "@/lib/projects/artwork-controls";
import { colourRows } from "@/lib/projects/colour-controls";
import { namesNumbersPanel } from "@/lib/projects/names-numbers-controls";
import { chosenOption, optionGroups, parameterSliders } from "./form";
import { jersey } from "./fixtures/article";
import { designSummary } from "./summary";
import { findingLines } from "./validate";

/**
 * The edges of the shell: a row the catalogue left empty, a colour with no swatch, a finding about
 * a whole article rather than a panel. Each is a case a real design reaches, and none of them may
 * invent a value to fill the gap.
 */

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const EMPTY = { options: {}, parameters: {} } as const;

describe("a catalogue row with gaps in it", () => {
  it("falls back to the gap rule for an option whose rule is empty", () => {
    const article = jersey();
    const options: OptionDef[] = article.options.map((option) => (option.code === "C01" ? { ...option, ruleId: "" } : option));

    expect(optionGroups({ ...article, options }, EMPTY)[0]?.tiles[0]?.ruleId).toBe("R-GAP-000");
  });

  it("falls back to the gap rule and to millimetres for a parameter with neither", () => {
    const article = jersey();
    const parameters: ParameterDef[] = article.parameters.map((def) => ({ ...def, ruleId: "", unit: null }));
    const slider = parameterSliders({ ...article, parameters }, EMPTY)[0];

    expect(slider).toMatchObject({ ruleId: "R-GAP-000", unit: "mm" });
  });

  it("leaves out a parameter the catalogue gave no ends", () => {
    const article = jersey();
    const parameters: ParameterDef[] = article.parameters.map((def) => ({ ...def, min: null }));

    expect(parameterSliders({ ...article, parameters }, EMPTY)).toEqual([]);
  });

  it("takes the first option of a group that marks none as the default", () => {
    const options = jersey().options.filter((option) => option.group === "collar").map((option) => ({ ...option, isDefault: false }));

    expect(chosenOption(options, undefined)).toBe("C01");
  });
});

describe("the summary of a design that has things on it", () => {
  it("lists a colour by its code and its swatch, and leaves out a part with neither", () => {
    const spec = start("team-jersey");
    const coloured = apply(spec, { type: "update-colourway", colourway: { ...spec.colourways[0]!, colours: [{ panelId: "body-front", colour: "19-4024 TCX", swatch: "#0b1f4b", provenance: "user-edited" }] } } as SpecAction);
    const rows = designSummary({ spec: coloured, article: jersey(), form: EMPTY, colours: colourRows(coloured), artwork: artworkRows(coloured), namesNumbers: namesNumbersPanel(coloured) }).find((entry) => entry.id === "colours")?.rows ?? [];

    expect(rows).toHaveLength(1);
    expect(rows[0]?.detail).toBe("19-4024 TCX · #0b1f4b");
  });

  it("says which places names and numbers are on", () => {
    const spec = start("team-jersey");
    const marked = apply(spec, { type: "set-names-numbers", namesAndNumbers: { places: [{ place: "back-name" }], colour: "", sampleName: "SMITH", sampleNumber: "7", provenance: "user-edited" } } as SpecAction);
    const rows = designSummary({ spec: marked, article: jersey(), form: EMPTY, colours: colourRows(marked), artwork: artworkRows(marked), namesNumbers: namesNumbersPanel(marked) }).find((entry) => entry.id === "names-numbers")?.rows ?? [];

    expect(rows[0]?.label).toBe("On");
    expect(rows[0]?.detail.length).toBeGreaterThan(0);
  });
});

describe("a finding about a whole article", () => {
  it("names the article where no panel is named, and nothing where neither is", () => {
    const lines = findingLines({
      checks: [
        { code: "moderation-clear", severity: "blocker", message: "The crest is waiting to be checked.", target: { article: "JSY-SS-01", panel: null }, ruleId: "R-GAP-000", passed: false },
        { code: "parameters-in-range", severity: null, message: "Nothing found.", target: { article: null, panel: null }, ruleId: "R-PAT-003", passed: false },
      ],
      draft: null,
      article: null,
      form: EMPTY,
    });

    expect(lines[0]).toMatchObject({ target: "JSY-SS-01", severity: "blocker" });
    expect(lines[1]).toMatchObject({ target: null, severity: "warning" });
  });

  it("keeps the rule the drafter named when it has one", () => {
    const lines = findingLines({ checks: [], draft: { kind: "not-drafted-yet", reason: "Not drafted yet: C02 has no collar shape.", ruleId: "R-CON-005" }, article: null, form: EMPTY });

    expect(lines[0]?.ruleId).toBe("R-CON-005");
  });
});
