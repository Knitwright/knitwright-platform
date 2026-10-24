import { describe, expect, it } from "vitest";
import { applyAction, garmentSpecSchema, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { applyKit, colourForPanel, CLUB_COLOURWAY_ID } from "./apply-kit";
import { EMPTY_KIT, type Kit } from "./kit";

const FILE = "6f1c1b0e-6a39-4b0e-8f0e-2b6a1d2f3c4d";
const LOGO = "0a1c1b0e-6a39-4b0e-8f0e-2b6a1d2f3c4d";
const KIT: Kit = {
  ...EMPTY_KIT,
  primaryColour: "#0b3d91",
  secondaryColour: "#ffffff",
  accentColour: "#f2c200",
  crestFileId: FILE,
  sponsors: [{ name: "Bakery", logoFileId: LOGO }, { name: "Garage", logoFileId: null }],
};

const apply = (spec: GarmentSpec, actions: readonly SpecAction[]): GarmentSpec =>
  actions.reduce((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, spec);

const top = () => start("crew-tee");

describe("colourForPanel", () => {
  it("gives body, sleeves and trims their own kit colour, falling back in order", () => {
    expect(colourForPanel("body-front", KIT)).toBe("#0b3d91");
    expect(colourForPanel("sleeve-left", KIT)).toBe("#ffffff");
    expect(colourForPanel("collar", KIT)).toBe("#f2c200");
    expect(colourForPanel("collar", { ...KIT, accentColour: null })).toBe("#ffffff");
    expect(colourForPanel("sleeve-left", { ...KIT, secondaryColour: null })).toBe("#0b3d91");
    expect(colourForPanel("body-front", EMPTY_KIT)).toBeNull();
  });
});

describe("applyKit", () => {
  it("puts the kit on a design as changes the garment rules accept", () => {
    const spec = top();
    const { actions } = applyKit(spec, KIT, ["colours", "crest", "sponsors"]);
    const next = apply(spec, actions);
    expect(garmentSpecSchema.safeParse(next).success).toBe(true);
    const way = next.colourways.find((c) => c.id === CLUB_COLOURWAY_ID);
    expect(way?.colours.find((c) => c.panelId === "body-front")?.swatch).toBe("#0b3d91");
    expect(way?.colours.every((c) => c.provenance === "brand-supplied")).toBe(true);
    expect(next.artwork.map((a) => a.id)).toEqual(["club-crest", "club-sponsor-1", "club-sponsor-2"]);
    const text = next.artwork.find((a) => a.id === "club-sponsor-2");
    expect(text?.source).toEqual({ kind: "text", text: "Garage" });
  });

  it("gives the design its own copy: it does not hold the kit", () => {
    const spec = top();
    const next = apply(spec, applyKit(spec, KIT, ["colours"]).actions);
    const after = applyKit(next, { ...KIT, primaryColour: "#000000" }, []);
    expect(after.actions).toEqual([]);
    expect(next.colourways.find((c) => c.id === CLUB_COLOURWAY_ID)?.colours.find((c) => c.panelId === "body-front")?.swatch).toBe("#0b3d91");
  });

  it("is repeatable: a second application updates, never duplicates", () => {
    const spec = top();
    const once = apply(spec, applyKit(spec, KIT, ["colours", "crest", "sponsors"]).actions);
    const again = apply(once, applyKit(once, { ...KIT, primaryColour: "#111111" }, ["colours", "crest", "sponsors"]).actions);
    expect(again.colourways.filter((c) => c.id === CLUB_COLOURWAY_ID)).toHaveLength(1);
    expect(again.artwork).toHaveLength(3);
    expect(again.colourways.find((c) => c.id === CLUB_COLOURWAY_ID)?.colours.find((c) => c.panelId === "body-front")?.swatch).toBe("#111111");
  });

  it("applies only the parts asked for", () => {
    const spec = top();
    const { actions } = applyKit(spec, KIT, ["crest"]);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("add-artwork");
  });

  it("says plainly what the kit lacks and invents nothing", () => {
    const spec = top();
    const result = applyKit(spec, EMPTY_KIT, ["colours", "crest", "sponsors"]);
    expect(result.actions).toEqual([]);
    expect(result.notes).toEqual([
      "The kit has no colours yet, so no colours were put on the design.",
      "The kit has no crest yet.",
      "The kit has no sponsors yet.",
    ]);
  });

  it("says when the garment has no place for a sponsor", () => {
    const spec = top();
    const three: Kit = { ...KIT, sponsors: [{ name: "A", logoFileId: null }, { name: "B", logoFileId: null }, { name: "C", logoFileId: null }] };
    const result = applyKit(spec, three, ["sponsors"]);
    expect(result.actions.length + result.notes.filter((n) => n.startsWith("This garment")).length).toBe(3);
  });

  it("is deterministic", () => {
    const spec = top();
    expect(applyKit(spec, KIT, ["colours", "crest", "sponsors"])).toEqual(applyKit(spec, KIT, ["sponsors", "crest", "colours"]));
  });
});
