import { describe, expect, it } from "vitest";
import { draft, layer } from "./fixtures/drafts";
import { periodSentence, publishable, publishInput, publishRepeatSchema } from "./publish";
import { tileText } from "./units";

/**
 * Publishing a repeat to Your library. The browser sends the recipe, never a picture: each picture
 * layer names an artwork already in the brand's library, which went through moderation on the way
 * in, so publishing cannot bring in a picture nobody screened.
 */

describe("the recipe a repeat publishes as", () => {
  it("sends the tile, the style, the background and the layers, and leaves the source pixels behind", () => {
    const input = publishInput(draft({ name: "  Club hoops  " }));
    expect(input).toMatchObject({ name: "Club hoops", unit: "cm", style: "full-drop", tileWidthTenths: 1000, tileHeightTenths: 1000, background: "#ffffff", wrap: true });
    expect(input.layers).toHaveLength(1);
    expect(input.layers[0]).not.toHaveProperty("sourcePx");
  });

  it("is taken by the schema the server checks it with", () => {
    expect(publishRepeatSchema.safeParse(publishInput(draft())).success).toBe(true);
  });

  it("refuses a layer that names both a picture and a shape, or neither", () => {
    const both = publishRepeatSchema.safeParse(publishInput(draft({ layers: [layer({ shape: "circle" })] })));
    expect(both.success).toBe(false);
    const neither = publishRepeatSchema.safeParse(publishInput(draft({ layers: [layer({ artworkId: null })] })));
    expect(neither.success).toBe(false);
  });

  it("refuses a picture layer whose artwork is not a library id", () => {
    expect(publishRepeatSchema.safeParse(publishInput(draft({ layers: [layer({ artworkId: "../../etc/passwd" })] }))).success).toBe(false);
  });

  it("refuses a colour that is not #rrggbb", () => {
    expect(publishRepeatSchema.safeParse({ ...publishInput(draft()), background: "red" }).success).toBe(false);
  });

  it("refuses more layers than a tile may hold", () => {
    const many = Array.from({ length: 25 }, (_unused, index) => layer({ id: `l${index}` }));
    expect(publishRepeatSchema.safeParse(publishInput(draft({ layers: many }))).success).toBe(false);
  });
});

describe("whether a repeat may be published", () => {
  it("publishes a repeat nothing blocks", () => {
    const ready = publishable(draft());
    expect(ready.ok).toBe(true);
    expect(ready.findings).toEqual([]);
  });

  it("publishes one with a warning, and hands the warning back so the person is told", () => {
    const ready = publishable(draft({ wrap: false, layers: [layer({ xTenths: 0 })] }));
    expect(ready.ok).toBe(true);
    expect(ready.findings.map((entry) => entry.code)).toEqual(["repeat-layer-outside-tile"]);
  });

  it("refuses one a blocker stops, with the reasons", () => {
    const refused = publishable(draft({ name: "", layers: [] }));
    expect(refused.ok).toBe(false);
    expect(refused.findings.map((entry) => entry.code)).toEqual(["repeat-no-name", "repeat-no-layers"]);
  });

  it("refuses one the schema catches that no finding covers, rather than sending it anyway", () => {
    const odd = publishable(draft({ layers: [layer({ rotationDeg: 400 })] }));
    expect(odd.ok).toBe(false);
    expect(odd.findings.at(-1)?.severity).toBe("blocker");
  });
});

describe("what the panel says beside Publish", () => {
  it("says what repeats once, in the unit being typed", () => {
    expect(periodSentence(draft(), (tenths) => `${tileText(tenths, "cm")} cm`)).toBe("Repeats every 10 cm across and 10 cm down.");
    expect(periodSentence(draft({ style: "half-drop" }), (tenths) => `${tileText(tenths, "cm")} cm`)).toBe("Repeats every 20 cm across and 10 cm down.");
  });
});
