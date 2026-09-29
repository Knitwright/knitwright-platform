import { describe, expect, it } from "vitest";
import { designWith, madeUpForType } from "@/lib/flat/fixtures/designs";
import { LAYERS } from "@/lib/flat/model";
import { applyAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { TOPS_IDS, fullDesign, packFor } from "../fixtures/designs";
import { NoDrawing } from "./errors";
import { PICTURE_LEFT_OUT } from "./limits";
import { buildSvg } from "./svg";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

describe("the SVG file of a view", () => {
  const pack = packFor(designWith("crew-tee", {}, madeUpForType("crew-tee", {})));

  it("starts with an XML declaration and then the drawing, once", () => {
    const svg = buildSvg(pack, "front", new Map());
    expect(svg.startsWith(`${XML_DECLARATION}\n<svg `)).toBe(true);
    expect(svg.match(/<\?xml/g)).toHaveLength(1);
  });

  it("keeps every named layer, as tools that open layers read them", () => {
    const svg = buildSvg(pack, "front", new Map());
    for (const layer of Object.values(LAYERS)) {
      expect(svg).toContain(`<g id="layer-${layer.id}" inkscape:groupmode="layer" inkscape:label="${layer.label}">`);
    }
  });

  it("carries the callouts as they are on the tech pack, with the code and the value", () => {
    expect(buildSvg(pack, "front", new Map())).toContain(">A 52.0 cm<");
  });

  it("gives a different drawing for each view, one file for each", () => {
    expect(buildSvg(pack, "front", new Map())).not.toBe(buildSvg(pack, "back", new Map()));
  });

  it("draws every tops type, empty and full, with no callout on a drawing that is not to scale", () => {
    for (const typeId of TOPS_IDS) {
      for (const view of ["front", "back"] as const) {
        expect(buildSvg(packFor(fullDesign(typeId)), view, new Map())).toContain('<g id="layer-panels"');
        const empty = buildSvg(packFor(start(typeId)), view, new Map());
        expect(empty).toContain("<desc>Not to scale");
        expect(empty).not.toMatch(/ cm</);
      }
    }
  });

  it("holds no script, no event handler and no address that leaves the file", () => {
    const svg = buildSvg(packFor(fullDesign("crew-tee")), "front", new Map());
    expect(svg).not.toMatch(/<script|<foreignObject|\son[a-z]+=|javascript:|<a\s|xlink:href|href="(?!data:)/i);
  });

  it("says in words that a picture was left out, without a digit, when it was", () => {
    const svg = buildSvg(pack, "front", new Map(), { pictureLeftOut: true });
    expect(svg).toContain(`<!-- ${PICTURE_LEFT_OUT} -->`);
    expect(PICTURE_LEFT_OUT).not.toMatch(/\d|--/);
    expect(buildSvg(pack, "front", new Map())).not.toContain(PICTURE_LEFT_OUT);
  });

  it("refuses a garment type with no drawing", () => {
    expect(() => buildSvg(packFor({ ...start("crew-tee"), typeId: "kilt" }), "front", new Map())).toThrow(NoDrawing);
  });

  it("writes text a person typed only as escaped text", () => {
    const result = applyAction(fullDesign("crew-tee"), {
      type: "add-artwork",
      artwork: { id: "x", name: "<b>&\"'", source: { kind: "text", text: "</svg><script>x</script>" }, panelId: "body-front", anchor: "left-chest", offsetX: 0, offsetY: 0, width: 500, height: 300, rotationDegrees: 0, technique: "embroidery", provenance: "user-edited" },
    });
    if (!result.ok) throw new Error(result.reason);
    const svg = buildSvg(packFor(result.spec), "front", new Map());
    expect(svg).not.toContain("<script");
  });
});
