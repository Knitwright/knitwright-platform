import { describe, expect, it } from "vitest";
import { buildFlat } from "./build";
import { TOPS_TYPE_IDS, designWith, madeUpForType, typedIn } from "./fixtures/designs";
import type { FlatModel, View } from "./model";
import { renderSvg } from "./render-svg";

/**
 * A change to any template shows up here as a changed drawing. If the change is on
 * purpose, update the snapshot and send the new pictures to the owner (action A6).
 * The measurements are made up. See docs/owner/flats/README.md.
 */

const VIEWS: readonly View[] = ["front", "back"];

const drawn = (typeId: string, choices: Record<string, string>, view: View): FlatModel => {
  const spec = designWith(typeId, choices, madeUpForType(typeId, choices));
  const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main", callouts: true });
  if (!model) throw new Error("No drawing");
  return model;
};

describe.each(TOPS_TYPE_IDS)("%s as drawn with its starting choices", (typeId) => {
  it.each(VIEWS)("%s view", (view) => {
    expect(renderSvg(drawn(typeId, {}, view))).toMatchSnapshot();
  });
});

describe("a fully loaded team jersey", () => {
  const choices = {
    neckline: "v-neck",
    "sleeve-type": "raglan",
    "sleeve-length": "long",
    "hem-shape": "curved",
    "side-panels": "contrast-insert",
    cuffs: "rib-cuff",
  };
  it.each(VIEWS)("%s view", (view) => {
    expect(renderSvg(drawn("team-jersey", choices, view))).toMatchSnapshot();
  });
});

describe("a drawing with no measurements", () => {
  it("is the same every time it is drawn", () => {
    const spec = designWith("crew-tee", {});
    const draw = () => {
      const model = buildFlat({ spec, measurements: typedIn(spec), view: "front", colourwayId: "main" });
      return renderSvg(model as FlatModel);
    };
    expect(draw()).toBe(draw());
    expect(draw()).toMatchSnapshot();
  });
});
