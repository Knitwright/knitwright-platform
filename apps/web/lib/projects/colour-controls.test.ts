import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { browserActionSchema } from "./browser-action";
import { colourAction, colourRows } from "./colour-controls";

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

  it("saves a picked colour as a colourway change, with the code left as the colour until one is typed", () => {
    const next = applied(spec, colourAction(spec, "body-front", { swatch: "#1b2a49" }));
    expect(next.colourways[0].colours).toEqual([{ panelId: "body-front", colour: "#1b2a49", swatch: "#1b2a49", provenance: "user-edited" }]);
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
