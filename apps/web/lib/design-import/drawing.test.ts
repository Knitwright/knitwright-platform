import { describe, expect, it } from "vitest";
import { createFakePieceMapper } from "@/lib/artwork-stack";
import { createStubProvider } from "@/lib/providers/stub";
import { createBudget } from "./budget";
import { drawingOf } from "./drawing";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { MARKS_REPLY, asText } from "./fixtures/replies";
import { renderTee } from "./fixtures/synthetic";
import { pendingPatternStage } from "./pattern";
import { runImport } from "./pipeline";

describe("drawingOf", () => {
  it("draws the outline in the ground colour and each mark where it was read", async () => {
    const out = await runImport(
      { bytes: (await renderTee({ extra: '<rect x="170" y="180" width="60" height="50" fill="#ffffff"/>' })).png, mediaType: "image/png" },
      { provider: createStubProvider([asText(MARKS_REPLY)]), template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern: pendingPatternStage, cleanup: null, budget: createBudget(), standIn: false },
    );
    if (!out.ok) throw new Error(out.reason);
    const drawing = drawingOf(out);
    expect(drawing.views).toHaveLength(1);
    expect(drawing.views[0].view).toBe("front");
    expect(drawing.views[0].fill).toMatch(/^#c[0-9a-f]{5}$/);
    expect(drawing.views[0].points.split(" ").length).toBeGreaterThan(5);
    expect(drawing.marks.map((m) => [m.kind, m.redrawn, m.text])).toEqual([["number", false, "10"], ["crest", true, null]]);
    expect(drawing.marks[0]).toMatchObject({ x: 0.43, w: 0.14 });
    expect(drawing.marks[0].ink).toMatch(/^#f[0-9a-f]{5}$/);
    expect(drawing.marks[1].ink).toBe("#1d2330");
  });

  it("leaves out a mark whose layer is not in the stack, and uses a neutral fill with no ground colour", () => {
    const stack = { schemaVersion: 1, views: ["front"], colours: [], layers: [], colourways: [{ id: "a", name: "a", colours: {} }] };
    const overlay = { views: [{ view: "front", outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], landmarks: [], model: "affine" }], marks: [{ layerId: "mark-9", view: "front", kind: "name", text: "X", box: { x: 0, y: 0, w: 0.1, h: 0.1 }, ink: null }] };
    const drawing = drawingOf({ stack, overlay } as never);
    expect(drawing.marks).toEqual([]);
    expect(drawing.views[0].fill).toBe("#d0d3da");
  });
});
