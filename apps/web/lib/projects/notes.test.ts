import { describe, expect, it } from "vitest";
import { specActionSchema, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { NOTE_MAX_LENGTH, clipNote, describeAction, describeProposal, restoreNote } from "./notes";

const jersey = (): GarmentSpec => start("team-jersey", "men");

const action = (value: unknown): SpecAction => specActionSchema.parse(value);

const fabric = (id: string, name: string) => ({
  id,
  name,
  composition: "",
  construction: "",
  weightGsm: null,
  finish: "",
  consumption: "",
  stretch: "not-set",
  provenance: "user-edited", sources: {}
});

const colourway = (id: string, name: string) => ({ id, name, colours: [] });

const artwork = (id: string, name: string) => ({
  id,
  name,
  source: { kind: "text", text: "FC" },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 1000,
  height: 500,
  rotationDegrees: 0,
  technique: "screen-print",
  provenance: "user-edited",
});

const withMesh = (): GarmentSpec =>
  ({ ...jersey(), fabrics: [jersey().fabrics[0], fabric("mesh", "Mesh")] }) as GarmentSpec;

describe("describeAction", () => {
  it("names the option and the choice by their labels", () => {
    const note = describeAction(
      jersey(),
      action({ type: "set-option", optionId: "sleeve-length", choiceId: "long", provenance: "user-edited" }),
    );

    expect(note).toBe("Sleeve length changed to Long sleeve.");
  });

  it("falls back to the ids for an option the type does not have", () => {
    const note = describeAction(
      jersey(),
      action({ type: "set-option", optionId: "mystery", choiceId: "thing", provenance: "user-edited" }),
    );

    expect(note).toBe("mystery changed to thing.");
  });

  it("says a measurement was set, in centimetres", () => {
    expect(
      describeAction(jersey(), action({ type: "set-measurement", pointId: "chest-width", value: 5250, provenance: "user-edited" })),
    ).toBe("Chest width set to 52.5 cm.");
    expect(
      describeAction(jersey(), action({ type: "set-measurement", pointId: "chest-width", value: 5255, provenance: "user-edited" })),
    ).toBe("Chest width set to 52.55 cm.");
  });

  it("says a measurement was removed", () => {
    expect(describeAction(jersey(), action({ type: "remove-measurement", pointId: "body-length" }))).toBe(
      "Your value for Body length was removed.",
    );
  });

  it("says the sizes were set, or removed", () => {
    const sizes = action({ type: "set-sizing", sizing: { sizes: ["S", "M", "L"], baseSize: "M" } });

    expect(describeAction(jersey(), sizes)).toBe("Sizes set to S, M, L. The base size is M.");
    expect(describeAction(jersey(), action({ type: "set-sizing", sizing: null }))).toBe("Sizes removed.");
  });

  it("describes a value for one size and a tolerance, set and removed", () => {
    const entry = { pointId: "body-length", size: "L", value: 7250, provenance: "user-edited" };
    expect(describeAction(jersey(), action({ type: "set-size-measurement", entry }))).toBe("Body length at size L set to 72.5 cm.");
    expect(describeAction(jersey(), action({ type: "remove-size-measurement", pointId: "body-length", size: "L" }))).toBe(
      "Your value for Body length at size L was removed.",
    );
    const tolerance = { pointId: "body-length", value: 100, provenance: "user-edited" };
    expect(describeAction(jersey(), action({ type: "set-tolerance", entry: tolerance }))).toBe("Tolerance for Body length set to 1 cm.");
    expect(describeAction(jersey(), action({ type: "remove-tolerance", pointId: "body-length" }))).toBe(
      "Your tolerance for Body length was removed.",
    );
  });

  it("counts the sizes instead of listing a very long run", () => {
    const many = Array.from({ length: 24 }, (_, index) => `SIZE-${index + 1}`);

    const note = describeAction(jersey(), action({ type: "set-sizing", sizing: { sizes: many, baseSize: many[3] } }));

    expect(note).toBe("Sizes set. There are 24 sizes and the base size is SIZE-4.");
  });

  it("names a fabric that is added, changed or removed", () => {
    expect(describeAction(jersey(), action({ type: "add-fabric", fabric: fabric("mesh", "Mesh") }))).toBe("Fabric Mesh added.");
    expect(describeAction(withMesh(), action({ type: "update-fabric", fabric: fabric("mesh", "Fine mesh") }))).toBe(
      "Fabric Fine mesh changed.",
    );
    expect(describeAction(withMesh(), action({ type: "remove-fabric", id: "mesh" }))).toBe("Fabric Mesh removed.");
    expect(describeAction(jersey(), action({ type: "remove-fabric", id: "gone" }))).toBe("A fabric was removed.");
  });

  it("says which panel uses which fabric", () => {
    expect(describeAction(withMesh(), action({ type: "assign-fabric", panelId: "body-front", fabricId: "mesh" }))).toBe(
      "Body front now uses Mesh.",
    );
    expect(describeAction(jersey(), action({ type: "assign-fabric", panelId: "nowhere", fabricId: "unknown" }))).toBe(
      "nowhere now uses unknown.",
    );
  });

  it("names a colourway that is added, changed or removed", () => {
    const withAway = { ...jersey(), colourways: [jersey().colourways[0], colourway("away", "Away")] } as GarmentSpec;

    expect(describeAction(jersey(), action({ type: "add-colourway", colourway: colourway("away", "Away") }))).toBe(
      "Colourway Away added.",
    );
    expect(describeAction(withAway, action({ type: "update-colourway", colourway: colourway("away", "Away kit") }))).toBe(
      "Colourway Away kit changed.",
    );
    expect(describeAction(withAway, action({ type: "remove-colourway", id: "away" }))).toBe("Colourway Away removed.");
    expect(describeAction(jersey(), action({ type: "remove-colourway", id: "gone" }))).toBe("A colourway was removed.");
  });

  it("names artwork that is added, changed or removed", () => {
    const withLogo = { ...jersey(), artwork: [artwork("logo", "Club crest")] } as GarmentSpec;

    expect(describeAction(jersey(), action({ type: "add-artwork", artwork: artwork("logo", "Club crest") }))).toBe(
      "Artwork Club crest added.",
    );
    expect(describeAction(withLogo, action({ type: "update-artwork", artwork: artwork("logo", "Big crest") }))).toBe(
      "Artwork Big crest changed.",
    );
    expect(describeAction(withLogo, action({ type: "remove-artwork", id: "logo" }))).toBe("Artwork Club crest removed.");
    expect(describeAction(jersey(), action({ type: "remove-artwork", id: "gone" }))).toBe("Artwork was removed.");
  });

  it("names the new wearer and the new garment type", () => {
    expect(describeAction(jersey(), action({ type: "change-wearer", wearer: "youth" }))).toBe("Made for youth.");
    expect(describeAction(jersey(), action({ type: "change-type", typeId: "polo" }))).toBe("Garment type changed to Polo shirt.");
    expect(describeAction(jersey(), action({ type: "change-type", typeId: "nope" }))).toBe("Garment type changed to nope.");
  });

  it("stays inside the length the database allows", () => {
    const note = describeAction(jersey(), action({ type: "add-fabric", fabric: fabric("mesh", "N".repeat(60)) }));

    expect(note.length).toBeLessThanOrEqual(NOTE_MAX_LENGTH);
  });

  it("does not change the design it is given", () => {
    const before = jersey();
    const copy = structuredClone(before);

    describeAction(before, action({ type: "change-type", typeId: "polo" }));

    expect(before).toEqual(copy);
  });
});

describe("describeAction, tech pack fields", () => {
  const polo = (): GarmentSpec => start("polo", "men");

  it("names a component by its label", () => {
    const note = describeAction(
      polo(),
      action({ type: "set-component", component: { id: "buttons", name: "Shell", details: "", quantity: "", provenance: "user-edited" } }),
    );
    expect(note).toBe("Details for Buttons saved.");
    expect(describeAction(polo(), action({ type: "remove-component", id: "buttons" }))).toBe("Details for Buttons removed.");
  });

  it("names a seam by its label", () => {
    const entry = { seamId: "body-hem", stitchDensity: "dense", provenance: "user-edited" };
    expect(describeAction(polo(), action({ type: "set-construction", entry }))).toBe("Stitch details for Body hem saved.");
    expect(describeAction(polo(), action({ type: "remove-construction", seamId: "body-hem" }))).toBe(
      "Stitch details for Body hem removed.",
    );
  });

  it("names a labelling field, and says removed when the text is empty", () => {
    const set = action({ type: "set-labelling", field: "care", text: "Wash cold", provenance: "user-edited" });
    const clear = action({ type: "set-labelling", field: "origin", text: "", provenance: "user-edited" });
    expect(describeAction(polo(), set)).toBe("Care instructions saved.");
    expect(describeAction(polo(), clear)).toBe("Country of origin removed.");
  });

  it("falls back to the id when the component or seam is not known", () => {
    expect(describeAction(polo(), action({ type: "remove-component", id: "mystery" }))).toBe("Details for mystery removed.");
    expect(describeAction(polo(), action({ type: "remove-construction", seamId: "mystery" }))).toBe(
      "Stitch details for mystery removed.",
    );
  });
});

describe("clipNote", () => {
  it("leaves a short note alone", () => {
    expect(clipNote("Done.")).toBe("Done.");
  });

  it("shortens a long note to the limit and ends it with dots", () => {
    const clipped = clipNote("x".repeat(500));

    expect(clipped).toHaveLength(NOTE_MAX_LENGTH);
    expect(clipped.endsWith("...")).toBe(true);
  });
});

describe("restoreNote", () => {
  it("names the version that was restored", () => {
    expect(restoreNote(4)).toBe("Restored version 4.");
  });
});

describe("describeProposal", () => {
  it("names who proposed the change and what it did", () => {
    expect(describeProposal("assistant", ["Fit changed from Regular to Slim."])).toBe(
      "By the assistant: Fit changed from Regular to Slim.",
    );
    expect(describeProposal("picture", ["A.", "B."])).toBe("Read from a picture: A. B.");
  });

  it("stays within the database's limit", () => {
    expect(describeProposal("assistant", ["x".repeat(500)]).length).toBe(NOTE_MAX_LENGTH);
  });
});
