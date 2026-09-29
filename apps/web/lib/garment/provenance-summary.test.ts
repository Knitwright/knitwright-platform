import { describe, expect, it } from "vitest";
import { applyAction } from "./apply-action";
import { accepted, fabric, rejected, setOption, start } from "./fixtures/specs";
import { provenanceSummary } from "./provenance-summary";

const FILE_ID = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";
const art = (patch: object = {}) => ({
  id: "logo",
  name: "Club crest",
  source: { kind: "file", fileId: FILE_ID },
  panelId: "body-front",
  anchor: "left-chest",
  offsetX: 0,
  offsetY: 0,
  width: 900,
  height: 900,
  technique: "embroidery",
  provenance: "ai-suggested",
  ...patch,
});

describe("provenance on every value", () => {
  it("starts default choices as derived and leaves sizing empty", () => {
    const spec = start("polo");
    expect(spec.options.collar).toEqual({ choiceId: "polo-collar", provenance: "derived" });
    expect(spec.sizing).toBeNull();
    expect(spec.schemaVersion).toBe(4);
  });

  it("stores who chose an option", () => {
    const spec = accepted(applyAction(start("polo"), setOption("fit", "slim", "ai-suggested"))).spec;
    expect(spec.options.fit).toEqual({ choiceId: "slim", provenance: "ai-suggested" });
  });

  it("refuses an option change with no provenance or with verified", () => {
    const spec = start("polo");
    expect(applyAction(spec, { type: "set-option", optionId: "fit", choiceId: "slim" }).ok).toBe(false);
    expect(applyAction(spec, setOption("fit", "slim", "verified")).ok).toBe(false);
  });

  it("requires provenance on a panel colour", () => {
    const colourway = (colours: object[]) => ({ id: "main", name: "Home", colours });
    const spec = start("polo");
    const bare = colourway([{ panelId: "collar", colour: "navy" }]);
    expect(applyAction(spec, { type: "update-colourway", colourway: bare }).ok).toBe(false);
    const full = colourway([{ panelId: "collar", colour: "navy", provenance: "read-from-image" }]);
    expect(accepted(applyAction(spec, { type: "update-colourway", colourway: full })).spec.colourways[0]?.colours[0]?.provenance).toBe("read-from-image");
  });
});

describe("artwork name and rotation", () => {
  it("needs a name and defaults the rotation to zero", () => {
    const spec = accepted(applyAction(start("polo"), { type: "add-artwork", artwork: art() })).spec;
    expect(spec.artwork[0]?.rotationDegrees).toBe(0);
    expect(spec.artwork[0]?.name).toBe("Club crest");
    expect(applyAction(start("polo"), { type: "add-artwork", artwork: art({ name: " " }) }).ok).toBe(false);
  });

  it("accepts rotation from 0 to 359 whole degrees only", () => {
    const spec = start("polo");
    for (const rotationDegrees of [0, 45, 359]) {
      expect(applyAction(spec, { type: "add-artwork", artwork: art({ rotationDegrees }) }).ok).toBe(true);
    }
    for (const rotationDegrees of [-1, 360, 1.5]) {
      expect(applyAction(spec, { type: "add-artwork", artwork: art({ rotationDegrees }) }).ok).toBe(false);
    }
  });
});

describe("sizing", () => {
  const sizing = (sizes: string[], baseSize: string) => ({ type: "set-sizing", sizing: { sizes, baseSize } });

  it("sets and clears the size run", () => {
    const set = accepted(applyAction(start("polo"), sizing(["S", "M", "L"], "M"))).spec;
    expect(set.sizing).toEqual({ sizes: ["S", "M", "L"], baseSize: "M" });
    const cleared = accepted(applyAction(set, { type: "set-sizing", sizing: null })).spec;
    expect(cleared.sizing).toBeNull();
  });

  it("refuses a base size outside the run, repeats, an empty run, too many sizes and long labels", () => {
    const spec = start("polo");
    const many = Array.from({ length: 25 }, (_, index) => `S${index}`);
    for (const bad of [
      sizing(["S", "M"], "L"),
      sizing(["S", "S"], "S"),
      sizing([], "S"),
      sizing(many, "S0"),
      sizing(["X".repeat(13)], "X".repeat(13)),
    ]) {
      expect(applyAction(spec, bad).ok).toBe(false);
    }
    expect(applyAction(spec, sizing(many.slice(0, 24), "S0")).ok).toBe(true);
  });
});

describe("provenanceSummary", () => {
  it("lists every value suggested by a model, read from an image or taken from a chart", () => {
    let spec = start("polo");
    for (const action of [
      setOption("fit", "slim", "ai-suggested"),
      setOption("cuffs", "rib-cuff", "user-edited"),
      { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "suggested-chart" },
      { type: "set-measurement", pointId: "body-length", value: 7000, provenance: "derived" },
      { type: "update-colourway", colourway: { id: "main", name: "Home", colours: [{ panelId: "collar", colour: "navy", provenance: "read-from-image" }] } },
      { type: "add-fabric", fabric: fabric("mesh", { provenance: "ai-suggested" }) },
      { type: "add-artwork", artwork: art() },
    ]) {
      spec = accepted(applyAction(spec, action)).spec;
    }
    expect(provenanceSummary(spec)).toEqual([
      { kind: "option", id: "fit", label: "Fit: Slim", provenance: "ai-suggested" },
      { kind: "measurement", id: "chest-width", label: "Chest width", provenance: "suggested-chart" },
      { kind: "fabric", id: "mesh", label: "Fabric mesh", provenance: "ai-suggested" },
      { kind: "colour", id: "collar", parentId: "main", label: "Home: Collar", provenance: "read-from-image" },
      { kind: "artwork", id: "logo", label: "Club crest", provenance: "ai-suggested" },
    ]);
  });

  it("lists nothing for a design made only by a person", () => {
    expect(provenanceSummary(start("polo"))).toEqual([]);
    expect(rejected(applyAction(start("polo"), { type: "remove-fabric", id: "main" }))).toBeTruthy();
  });
});
