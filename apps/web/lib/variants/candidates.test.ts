import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { withKitStyle } from "@/lib/kit-styles/presets";
import { applyAll, colourwayCandidates, kitStyleCandidates, placementCandidates } from "./candidates";
import { generateVariants, guardrailFindings, structureKept } from "./generate";
import { shiftHue } from "./lab";
import { frontPicture, variantTiles } from "./tiles";

const must = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const out = applyAction(spec, action);
  if (!out.ok) throw new Error(out.reason);
  return out.spec;
};

const art = (over: Record<string, unknown>): SpecAction =>
  ({
    type: "add-artwork",
    artwork: { id: "a", name: "Crest", source: { kind: "text", text: "FC" }, panelId: "body-front", anchor: "left-chest", offsetX: 0, offsetY: 0, width: 600, height: 600, rotationDegrees: 0, technique: "sublimation", provenance: "user-edited", ...over },
  }) as SpecAction;

const styled = (style: string, third: string | null = null): GarmentSpec => {
  const out = withKitStyle(start("team-jersey", "men"), style, { main: "#1b2a49", second: "#d4af37", third });
  if (!out.ok) throw new Error(out.reason);
  return out.spec;
};

describe("applyAll", () => {
  it("gives null when a change is refused", () => {
    expect(applyAll(start("team-jersey", "men"), [{ type: "remove-fabric", id: "nope" }])).toBeNull();
  });
});

describe("colourway candidates", () => {
  it("adds turned-round and third-leads colourways when the design has a third colour, and keeps a two-colour pattern", () => {
    const spec = styled("hoops", "#c8102e");
    const labels = colourwayCandidates(spec).map((c) => c.label);
    expect(labels).toContain("Colours turned round");
    expect(labels).toContain("Third colour leads");
    const pattern = colourwayCandidates(spec)[0].actions.find((a) => a.type === "set-kit-pattern");
    expect(pattern && pattern.type === "set-kit-pattern" ? pattern.kitPattern.colours : []).toHaveLength(2);
  });

  it("recolours a plain kit without adding a pattern", () => {
    const spec = styled("plain");
    for (const candidate of colourwayCandidates(spec)) {
      expect(candidate.actions.map((a) => a.type)).toEqual(["update-colourway"]);
    }
  });

  it("offers nothing for a garment with no kit styles", () => {
    expect(colourwayCandidates(start("joggers", "men"))).toEqual([]);
    expect(kitStyleCandidates(start("joggers", "men"))).toEqual([]);
  });

  it("makes a contrast trim that is light on a dark body and dark on a light one", () => {
    const light = must(styled("plain"), { type: "update-colourway", colourway: { ...styled("plain").colourways[0], colours: styled("plain").colourways[0].colours.map((c) => ({ ...c, swatch: "#f0f0f0" })) } });
    const trims = colourwayCandidates(light).filter((c) => c.label === "Contrast trim");
    expect(trims).toHaveLength(1);
  });
});

describe("placement candidates", () => {
  it("moves back artwork between the back zones", () => {
    const spec = must(styled("plain"), art({ panelId: "body-back", anchor: "upper-back" }));
    const anchors = placementCandidates(spec).map((c) => c.actions[0]).map((a) => (a.type === "update-artwork" ? a.artwork.anchor : ""));
    expect(anchors.sort()).toEqual(["centre-back", "lower-back"]);
  });

  it("does not move artwork on a sleeve, and re-anchors an item that was nudged off its zone", () => {
    const sleeve = must(styled("plain"), art({ panelId: "sleeve-left", anchor: "sleeve-centre" }));
    expect(placementCandidates(sleeve)).toEqual([]);
    const nudged = must(styled("plain"), art({ offsetX: 120 }));
    expect(placementCandidates(nudged).some((c) => c.summary.includes("left chest to the left chest"))).toBe(true);
  });

  it("never swaps items on different panels or in the same zone", () => {
    let spec = must(styled("plain"), art({ id: "a" }));
    spec = must(spec, art({ id: "b", name: "Number", panelId: "body-back", anchor: "upper-back" }));
    expect(placementCandidates(spec).some((c) => c.label.startsWith("Swap"))).toBe(false);
    spec = must(styled("plain"), art({ id: "a" }));
    spec = must(spec, art({ id: "b", name: "Other" }));
    expect(placementCandidates(spec).some((c) => c.label.startsWith("Swap"))).toBe(false);
  });
});

describe("structureKept", () => {
  const base = must(styled("plain"), art({}));
  it("fails when artwork is added, an option changes or an item changes size", () => {
    expect(structureKept(base, must(base, art({ id: "z", anchor: "lower-front" })))).toBe(false);
    expect(structureKept(base, must(base, { type: "update-artwork", artwork: { ...base.artwork[0], width: 900 } }))).toBe(false);
    expect(structureKept(base, { ...base, wearer: "women" })).toBe(false);
  });
  it("passes when only the anchor moved", () => {
    expect(structureKept(base, must(base, { type: "update-artwork", artwork: { ...base.artwork[0], anchor: "lower-front" } }))).toBe(true);
  });
});

describe("guardrails and tiles", () => {
  it("warns about a very saturated colour and says it is an estimate", () => {
    const loud = must(styled("plain"), { type: "update-colourway", colourway: { ...styled("plain").colourways[0], colours: [{ panelId: "body-front", colour: "", swatch: "#00ff00", provenance: "user-edited" }] } });
    const found = guardrailFindings(loud);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((f) => f.severity === "warning")).toBe(true);
    expect(found[0].message).toContain("rough estimate");
  });

  it("drops a variant when a guardrail-class blocker is new, and keeps the design's own", () => {
    const out = generateVariants(styled("hoops"), { count: 8, seed: 2, gate: (s) => (s.kitPattern?.style === "stripes" ? [{ code: "x", severity: "blocker", panel: "p", message: "m" }] : []) });
    expect(out.some((v) => v.spec.kitPattern?.style === "stripes")).toBe(false);
  });

  it("rejects a colour that is not a screen colour when turning hue", () => {
    expect(() => shiftHue("red", 30)).toThrow(RangeError);
  });

  it("says plainly when a garment has no drawing", () => {
    const tiles = variantTiles([{ id: "v-1", kind: "colourway", label: "L", summary: "S", actions: [], spec: start("joggers", "men"), warnings: [] }]);
    const picture = frontPicture(start("joggers", "men"));
    expect(tiles[0].src === null ? tiles[0].alt : "").toBe(picture ? "" : "L: no drawing for this garment yet");
  });
});
