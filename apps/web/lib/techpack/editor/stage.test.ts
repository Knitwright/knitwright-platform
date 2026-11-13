import { describe, expect, it } from "vitest";
import { article, mark } from "../view/fixtures/views";
import { STAGE_BOX, STAGE_PANEL, stageCallouts, stagePointFrom, stagePoints } from "./stage";

describe("the measurement points on the stage", () => {
  it("places every point of JSY-SS-01 by its article code, red letters A onwards", () => {
    const rows = article().poms.map((pom) => ({ letter: pom.letter, code: pom.code, description: pom.description }));
    const placed = stagePoints(rows);
    expect(placed.notDrawn).toEqual([]);
    expect(placed.drawn.map((point) => point.letter)).toEqual(rows.map((row) => row.letter));
    for (const point of placed.drawn) {
      expect(point.at.x).toBeGreaterThanOrEqual(0);
      expect(point.at.x).toBeLessThanOrEqual(STAGE_BOX.width);
    }
    expect(placed.drawn.find((point) => point.letter === "A")?.line).not.toBeNull();
  });

  it("falls back on the words of the description, and lists a point it cannot place", () => {
    const placed = stagePoints([
      { letter: "A", code: "X1", description: "Chest half" },
      { letter: "Z", code: "QQ", description: "Pocket opening" },
    ]);
    expect(placed.drawn.map((point) => point.letter)).toEqual(["A"]);
    expect(placed.notDrawn).toEqual(["Z"]);
  });
});

describe("the numbered callouts on the stage", () => {
  it("number the base's construction first, then the founder's own, as the Callouts tab does", () => {
    const steps = article().construction;
    const drawn = mark({ id: "c1", tool: "callout", label: "Crest", note: "Centre it", points: [{ panelId: STAGE_PANEL, xMm: 120, yMm: 200 }] });
    const callouts = stageCallouts(article(), [drawn, mark()]);
    expect(callouts).toHaveLength(steps.length + 1);
    expect(callouts[0]?.number).toBe(steps[0]?.step);
    const own = callouts.at(-1);
    expect(own).toMatchObject({ number: steps.length + 1, markId: "c1", at: { x: 120, y: 200 }, text: "Crest: Centre it" });
  });

  it("place a callout drawn on a 2D panel by its words, or nowhere", () => {
    const onPanel = mark({ id: "c2", tool: "callout", label: "Hem detail", note: null, points: [{ panelId: "front", xMm: 1, yMm: 1 }] });
    const lost = mark({ id: "c3", tool: "callout", label: "Something", note: null, points: [{ panelId: "front", xMm: 1, yMm: 1 }] });
    const callouts = stageCallouts(null, [onPanel, lost]);
    expect(callouts[0]).toMatchObject({ number: 1, text: "Hem detail" });
    expect(callouts[0]?.at).not.toBeNull();
    expect(callouts[1]?.at).toBeNull();
  });

  it("turns a click on the stage into a stage place, kept inside the box", () => {
    expect(stagePointFrom(0.5, 0.25)).toEqual({ panelId: STAGE_PANEL, xMm: 200, yMm: 120 });
    expect(stagePointFrom(-1, 2)).toEqual({ panelId: STAGE_PANEL, xMm: 0, yMm: STAGE_BOX.height });
    expect(stagePointFrom(Number.NaN, 0)).toEqual({ panelId: STAGE_PANEL, xMm: 0, yMm: 0 });
  });
});
