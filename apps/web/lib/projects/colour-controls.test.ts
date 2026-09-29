import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { browserActionSchema } from "./browser-action";
import { activeColourwayId, colourAction, colourRows, colourwayChoices, colourwayParam, normaliseSwatch } from "./colour-controls";

const applied = (spec: GarmentSpec, request: ReturnType<typeof colourAction>): GarmentSpec => {
  if (request.kind !== "action") throw new Error("Expected an action");
  const parsed = browserActionSchema.parse(request.action);
  const result = applyAction(spec, parsed);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

describe("colourRows", () => {
  it("has one row for each panel of the design, from the registry, with plain labels", () => {
    const rows = colourRows(start("polo"));
    expect(rows.map((row) => row.panelId)).toEqual(["body-front", "body-back", "sleeve-left", "sleeve-right", "collar", "placket"]);
    expect(rows.map((row) => row.label)).toContain("Left sleeve");
  });

  it("follows the options: a design with side panels and cuffs has rows for them", () => {
    const base = start("team-jersey");
    const spec: GarmentSpec = {
      ...base,
      options: { ...base.options, "side-panels": { choiceId: "contrast-insert", provenance: "user-edited" }, cuffs: { choiceId: "rib-cuff", provenance: "user-edited" } },
    };
    const ids = colourRows(spec).map((row) => row.panelId);
    expect(ids).toContain("side-panels");
    expect(ids).toContain("cuffs");
    expect(ids).toContain("neckband");
  });

  it("starts every panel with no colour and a neutral picker value", () => {
    const [row] = colourRows(start("crew-tee"));
    expect(row).toMatchObject({ colourText: "", swatch: "#e5e7eb", hasSwatch: false });
  });

  it("shows what the first colourway holds", () => {
    const base = start("crew-tee");
    const spec = { ...base, colourways: [{ ...base.colourways[0], colours: [{ panelId: "body-front", colour: "Navy 123", swatch: "#1b2a49", provenance: "user-edited" as const }] }] } as GarmentSpec;
    expect(colourRows(spec)[0]).toMatchObject({ colourText: "Navy 123", swatch: "#1b2a49", hasSwatch: true });
  });
});

describe("colourAction", () => {
  const spec = start("crew-tee");

  it("saves a picked colour and leaves the code EMPTY: a screen colour is not a reference for a factory", () => {
    const next = applied(spec, colourAction(spec, "body-front", { swatch: "#1b2a49" }));
    expect(next.colourways[0].colours).toEqual([{ panelId: "body-front", colour: "", swatch: "#1b2a49", provenance: "user-edited" }]);
    expect(colourRows(next)[0]).toMatchObject({ colourText: "", swatch: "#1b2a49", hasSwatch: true });
  });

  it("keeps the code empty when the swatch is changed, and keeps a typed code when it is", () => {
    const first = applied(spec, colourAction(spec, "body-front", { swatch: "#1b2a49" }));
    const again = applied(first, colourAction(first, "body-front", { swatch: "#222222" }));
    expect(again.colourways[0].colours[0]).toMatchObject({ colour: "", swatch: "#222222" });
    const typed = applied(again, colourAction(again, "body-front", { colourText: "Navy 19-4052" }));
    const moved = applied(typed, colourAction(typed, "body-front", { swatch: "#333333" }));
    expect(moved.colourways[0].colours[0]).toMatchObject({ colour: "Navy 19-4052", swatch: "#333333" });
  });

  it("clears the swatch and keeps the code when only the swatch is cleared", () => {
    const typed = applied(spec, colourAction(spec, "body-front", { colourText: "Navy", swatch: "#111111" }));
    const next = applied(typed, colourAction(typed, "body-front", { swatch: null }));
    expect(next.colourways[0].colours).toEqual([{ panelId: "body-front", colour: "Navy", provenance: "user-edited" }]);
  });

  it("saves a typed code and keeps the swatch that was picked", () => {
    const first = applied(spec, colourAction(spec, "body-front", { swatch: "#1b2a49" }));
    const next = applied(first, colourAction(first, "body-front", { colourText: "Pantone 19-4052" }));
    expect(next.colourways[0].colours[0]).toMatchObject({ colour: "Pantone 19-4052", swatch: "#1b2a49" });
  });

  it("saves a code with no swatch, which is then drawn in grey", () => {
    const next = applied(spec, colourAction(spec, "body-back", { colourText: "Heather grey" }));
    expect(next.colourways[0].colours[0]).toEqual({ panelId: "body-back", colour: "Heather grey", provenance: "user-edited" });
  });

  it("keeps the other panels", () => {
    const first = applied(spec, colourAction(spec, "body-front", { swatch: "#111111" }));
    const next = applied(first, colourAction(first, "body-back", { swatch: "#222222" }));
    expect(next.colourways[0].colours.map((entry) => entry.panelId)).toEqual(["body-front", "body-back"]);
  });

  it("removes the colour when both the code and the swatch are cleared", () => {
    const first = applied(spec, colourAction(spec, "body-front", { swatch: "#1b2a49" }));
    const next = applied(first, colourAction(first, "body-front", { colourText: "", swatch: null }));
    expect(next.colourways[0].colours).toEqual([]);
  });

  it("refuses a swatch that is not #rrggbb, with a plain sentence", () => {
    expect(colourAction(spec, "body-front", { swatch: "red" })).toEqual({ kind: "problem", reason: "Pick a colour, such as #1b2a49." });
  });

  it("refuses a code that is too long or holds a line break", () => {
    const long = colourAction(spec, "body-front", { colourText: "x".repeat(61) });
    expect(long).toEqual({ kind: "problem", reason: "Use 60 characters or fewer." });
    const broken = colourAction(spec, "body-front", { colourText: "a\nb" });
    expect(broken.kind).toBe("problem");
  });

  it("refuses a panel the design does not have", () => {
    expect(colourAction(spec, "cuffs", { swatch: "#111111" })).toEqual({ kind: "problem", reason: "This design has no such part to colour." });
  });

  it("does not change the design it is given", () => {
    const frozen = JSON.stringify(spec);
    colourAction(spec, "body-front", { swatch: "#111111" });
    expect(JSON.stringify(spec)).toBe(frozen);
  });
});

describe("normaliseSwatch", () => {
  it("turns what a person types into #rrggbb in lower case", () => {
    expect(normaliseSwatch("#1B2A49")).toBe("#1b2a49");
    expect(normaliseSwatch(" 1b2a49 ")).toBe("#1b2a49");
    expect(normaliseSwatch("")).toBeNull();
  });

  it("hands anything else back as it was, so the refusal names it", () => {
    expect(normaliseSwatch("#123")).toBe("#123");
    expect(normaliseSwatch("navy")).toBe("navy");
    expect(colourAction(start("crew-tee"), "body-front", { swatch: normaliseSwatch("navy") }).kind).toBe("problem");
  });
});

describe("more than one colourway", () => {
  const base = start("crew-tee");
  const spec = {
    ...base,
    colourways: [
      { ...base.colourways[0], colours: [{ panelId: "body-front", colour: "Navy", swatch: "#111111", provenance: "user-edited" as const }] },
      { id: "away", name: "Away", colours: [{ panelId: "body-front", colour: "White", swatch: "#eeeeee", provenance: "user-edited" as const }] },
    ],
  } as GarmentSpec;

  it("lists them, marks the one shown, and falls back to the first for an id that is not there", () => {
    expect(colourwayChoices(spec, "away")).toEqual([
      { id: "main", name: "Main colourway", selected: false },
      { id: "away", name: "Away", selected: true },
    ]);
    expect(activeColourwayId(spec, "away")).toBe("away");
    expect(activeColourwayId(spec, "nope")).toBe("main");
    expect(activeColourwayId(spec, undefined)).toBe("main");
  });

  it("shows the colours of the colourway chosen", () => {
    expect(colourRows(spec, "away")[0]).toMatchObject({ colourText: "White", swatch: "#eeeeee" });
    expect(colourRows(spec)[0]).toMatchObject({ colourText: "Navy", swatch: "#111111" });
  });

  it("changes only the colourway chosen", () => {
    const next = applied(spec, colourAction(spec, "body-front", { swatch: "#abcdef" }, "away"));
    expect(next.colourways[0].colours[0]?.swatch).toBe("#111111");
    expect(next.colourways[1]?.colours[0]?.swatch).toBe("#abcdef");
  });
});

describe("colourwayParam", () => {
  it("reads the colourway named in the address, whatever shape the framework hands over", () => {
    expect(colourwayParam("away")).toBe("away");
    expect(colourwayParam(["away", "main"])).toBe("away");
    expect(colourwayParam(undefined)).toBeUndefined();
    expect(colourwayParam("")).toBeUndefined();
    expect(colourwayParam([])).toBeUndefined();
  });
});
