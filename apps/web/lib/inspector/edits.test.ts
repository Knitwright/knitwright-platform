import { describe, expect, it } from "vitest";
import { browserActionSchema } from "@/lib/projects/browser-action";
import { editorHref, onSlider, optionsIn, parameterChange, swatchChange } from "./edits";
import type { InspectorSlider } from "./types";

const slider: InspectorSlider = {
  key: "body_length_offset",
  label: "Body length",
  min: -30,
  max: 40,
  step: 10,
  value: 0,
  unit: "mm",
  valueText: "0 mm",
  rangeText: "Range −30 to +40 mm",
  locked: false,
  lockNote: null,
  ruleId: "R-GAP-000",
};
const article = { baseArticleCode: "JSY-SS-01", productionClass: "A" as const, parameters: { drop_tail: 0 } };

describe("the inspector's changes", () => {
  it("keeps a slider inside its range and on its steps", () => {
    expect(onSlider(slider, 20)).toBe(true);
    expect(onSlider(slider, -30)).toBe(true);
    expect(onSlider(slider, 50)).toBe(false);
    expect(onSlider(slider, 15)).toBe(false);
    expect(onSlider(slider, Number.NaN)).toBe(false);
  });

  it("stores a parameter as the whole base article, keeping the others, in a shape the editor's action reads", () => {
    const change = parameterChange(article, slider, 20);
    expect(change).toEqual({ type: "set-article", article: { ...article, parameters: { drop_tail: 0, body_length_offset: 20 } } });
    expect(browserActionSchema.safeParse(change).success).toBe(true);
    expect(parameterChange(article, slider, 25)).toBeNull();
    expect(parameterChange(null, slider, 20)).toBeNull();
  });

  it("recolours one part of the shown colourway and keeps its colour code", () => {
    const colourway = { id: "home", name: "Home", colours: [{ panelId: "body-front", colour: "Navy 19-4024", swatch: "#0b1f4b" }] };
    const change = swatchChange(colourway, "body-front", "#F2B705");
    expect(change).toMatchObject({ type: "update-colourway", colourway: { id: "home", colours: [{ panelId: "body-front", colour: "Navy 19-4024", swatch: "#f2b705" }] } });
    expect(browserActionSchema.safeParse(change).success).toBe(true);
    const added = swatchChange(colourway, "sleeve-left", "#ffffff");
    expect((added as { colourway: { colours: unknown[] } }).colourway.colours).toHaveLength(2);
    expect(swatchChange(colourway, "body-front", "navy")).toBeNull();
  });

  it("reads the option codes the address names, as the editor writes them", () => {
    expect(optionsIn("?opt=collar:C02&opt=sleeve_finish:K01&opt=bad&board=x")).toEqual({ collar: "C02", sleeve_finish: "K01" });
    expect(optionsIn("")).toEqual({});
  });

  it("opens the full editor on the options, parameters, colourway and size shown", () => {
    const view = {
      options: {
        groups: [{ group: "collar", label: "Collar", options: [{ code: "C02", label: "V-neck", chosen: true, locked: false, lockNote: null, ruleId: "R", extraCost: null }] }],
        sliders: [{ ...slider, value: 20 }],
        empty: null,
      },
    };
    const href = editorHref("canvas-1", "board-1", view, { colourwayId: "away", size: "L" });
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/project/canvas-1");
    expect(url.searchParams.get("focus")).toBe("board-1");
    expect(url.searchParams.getAll("opt")).toEqual(["collar:C02"]);
    expect(url.searchParams.getAll("par")).toEqual(["body_length_offset:20"]);
    expect(url.searchParams.get("colourway")).toBe("away");
    expect(url.searchParams.get("size")).toBe("L");
    expect(new URL(editorHref("c", "b", view, { colourwayId: null, size: null }), "http://x").searchParams.has("size")).toBe(false);
  });
});
