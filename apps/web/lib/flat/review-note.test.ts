import { describe, expect, it } from "vitest";
import { buildFlat } from "./build";
import { designWith, madeUpValues, typedIn } from "./fixtures/designs";
import { withReviewNote } from "./review-note";
import { renderSvg } from "./render-svg";

const model = () => {
  const spec = designWith("crew-tee", {}, madeUpValues({}));
  const built = buildFlat({ spec, measurements: typedIn(spec), view: "front", colourwayId: "main" });
  if (!built) throw new Error("No drawing");
  return built;
};

describe("withReviewNote", () => {
  it("adds a visible line of text in its own last layer and makes room for it", () => {
    const before = model();
    const after = withReviewNote(before, "Made-up sizes for review of the drawing only");
    expect(after.layers.at(-1)?.id).toBe("note");
    expect(after.layers).toHaveLength(before.layers.length + 1);
    expect(after.bounds.minY).toBeLessThan(before.bounds.minY);
    expect(after.bounds.maxX).toBeGreaterThanOrEqual(before.bounds.maxX);
    expect(renderSvg(after)).toContain(">Made-up sizes for review of the drawing only</text>");
  });

  it("leaves the model it was given alone", () => {
    const before = model();
    const frozen = JSON.stringify(before);
    withReviewNote(before, "x");
    expect(JSON.stringify(before)).toBe(frozen);
  });

  it("keeps the whole line inside the box even when the drawing is narrow", () => {
    const after = withReviewNote(model(), "A very long line of words that runs on and on and on and on and on");
    const text = after.layers.at(-1)?.elements[0];
    expect(text?.kind).toBe("text");
    if (text?.kind === "text") expect(text.at.x + text.text.length * text.size * 0.62).toBeLessThanOrEqual(after.bounds.maxX + 1);
  });
});
