import { describe, expect, it } from "vitest";
import { parseArtworkStack, ARTWORK_STACK_VERSION } from "@/lib/artwork-stack";
import { toStackColours } from "../colours";
import { cutOf, generatorLayer, layerIds, pictureLayer, repeatOf, repeatSentence } from "./layers";

const colours = toStackColours([{ lab: [40, 60, 30], rgb: [200, 16, 46], hex: "#c8102e", share: 0.7 }, { lab: [100, 0, 0], rgb: [255, 255, 255], hex: "#ffffff", share: 0.3 }]);
const placed = { view: "front" as const, step: 1.5, colours };

describe("the layers of a proposal", () => {
  it("makes a pattern layer the stack accepts, with the start in the datum and settings to 0.1 mm", () => {
    const layer = generatorLayer(placed, { generatorId: "stripe-variations", params: { width: 20.04, angle: 45, rhythm: 0, grow: 0.5 }, inkIds: ["colour-2"], shift: { sx: 11, sy: 4 }, movesWithDatum: true, label: "Stripe variations" });
    expect(layer).toMatchObject({ id: "pattern-front", kind: "pattern", params: { width: 20, angle: 45 }, datum: { offsetMm: { x: -16.5, y: -6 } }, provenance: "read-from-image" });
    const stack = parseArtworkStack({ schemaVersion: ARTWORK_STACK_VERSION, views: ["front"], colours, layers: [{ id: "ground", kind: "ground", views: ["front"], opacity: 1, blend: "normal", provenance: "read-from-image", colourId: colours[0].id }, layer], colourways: [{ id: "as-read", name: "As read", colours: Object.fromEntries(colours.map((c) => [c.id, { screen: c.screen, codes: c.codes, provenance: c.provenance }])) }] });
    expect(stack.ok ? "ok" : stack.reason).toBe("ok");
  });

  it("leaves the datum alone for a style that anchors to the piece, and keeps a yes-or-no setting as it is", () => {
    const layer = generatorLayer(placed, { generatorId: "kit-dots", params: { halfDrop: true, pitchMm: 36 }, inkIds: ["colour-2"], shift: { sx: 3, sy: 3 }, movesWithDatum: false, label: "Polka dots" });
    expect(layer).toMatchObject({ params: { halfDrop: true, pitchMm: 36 }, datum: { offsetMm: { x: 0, y: 0 } } });
  });

  it("makes a picture fill at the cut's own place, drawn or not", () => {
    const cut = cutOf("back", "tile", { minX: -10.004, minY: 5, maxX: 20, maxY: 40 }, false);
    expect(cut).toEqual({ assetId: "tile-back", view: "back", area: { minX: -10.004, minY: 5, maxX: 20, maxY: 40 }, clip: false });
    const alt = pictureLayer({ ...placed, view: "back" }, { id: layerIds("back").alternative, name: "Alt", cut, mode: "tile", opacity: 0 });
    expect(alt).toMatchObject({ id: "pattern-back-alt", kind: "image-fill", opacity: 0, assetId: "tile-back", offsetMm: { x: -10, y: 5 }, scale: 1, halfDrop: false, fit: "cover" });
  });

  it("says a repeat in centimetres, labelled as an estimate, with one axis when only one repeats", () => {
    expect(repeatSentence(repeatOf(65.04, 90))).toBe("The repeat is about 6.5 cm across and 9 cm down (estimated, check it).");
    expect(repeatSentence(repeatOf(40, null))).toBe("The repeat is about 4 cm across (estimated, check it).");
    expect(repeatSentence(repeatOf(null, 30))).toBe("The repeat is about 3 cm down (estimated, check it).");
    expect(repeatOf(1, 2).label).toBe("estimated, check it");
  });
});
