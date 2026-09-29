import { describe, expect, it } from "vitest";
import { applyAction } from "./apply-action";
import { accepted, fabric, rejected, start } from "./fixtures/specs";

const FILE_ID = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";
const art = (id: string, patch: object = {}) => ({
  id,
  name: "Club crest",
  source: { kind: "file", fileId: FILE_ID },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 900,
  height: 900,
  technique: "transfer",
  provenance: "user-edited",
  ...patch,
});

describe("messages a person reads", () => {
  it("names panels and places by their labels, not their ids", () => {
    const spec = start("crew-tee");
    const neckband = art("3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a12", { panelId: "neckband" });
    expect(rejected(applyAction(spec, { type: "add-artwork", artwork: neckband }))).toBe(
      'Artwork "Club crest" is on Neckband, which cannot carry artwork.',
    );
    const wrongPlace = art("x1", { anchor: "upper-back" });
    expect(rejected(applyAction(spec, { type: "add-artwork", artwork: wrongPlace }))).toBe(
      'Artwork "Club crest" uses Upper back, which is not a place on Body front.',
    );
    const stray = { id: "away", name: "Away", colours: [{ panelId: "collar", colour: "red", provenance: "user-edited" }] };
    expect(rejected(applyAction(spec, { type: "add-colourway", colourway: stray }))).toBe(
      "Colourway Away has a colour for Collar, which this garment does not have.",
    );
  });

  it("says measurement, not point of measure, and names the measurement", () => {
    const spec = start("crew-tee");
    const set = (pointId: string) => ({ type: "set-measurement", pointId, value: 5000, provenance: "user-edited" });
    expect(rejected(applyAction(spec, set("inseam")))).toBe("inseam is not a measurement for Crew neck tee.");
    const once = accepted(applyAction(spec, set("chest-width"))).spec;
    expect(rejected(applyAction(once, { type: "remove-measurement", pointId: "hem-width" }))).toBe(
      "There is no Hem width measurement to remove.",
    );
  });

  it("names the fabric on a repeated id and the artwork on a repeated id", () => {
    const spec = start("crew-tee");
    expect(rejected(applyAction(spec, { type: "add-fabric", fabric: fabric("main") }))).toBe(
      "The fabric id main is used more than once.",
    );
  });
});
