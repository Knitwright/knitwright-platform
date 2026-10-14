import { describe, expect, it, vi } from "vitest";
import { toStackColours } from "../colours";
import { drawKnown, renderFlat, repeatTile, type KnownPattern } from "../fixtures/known";
import type { PatternInput } from "../pattern";
import { createMatchBudget } from "./budget";
import { createPatternStage } from "./stage";

// These run the real pattern matching on whole pictures, which is slower under coverage.
vi.setConfig({ testTimeout: 60_000 });

const STEP = 1.5;
const FRAME = { width: 240, height: 260, step: STEP, originX: -180, originY: 0 };

const colours = (hexes: readonly string[]) => toStackColours(hexes.map((hex, at) => ({ lab: [at * 10, 0, 0], rgb: [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)], hex, share: 1 - at * 0.1 })));

const inputFor = (flat: PatternInput["flat"], hexes: readonly string[]): PatternInput => ({
  view: "front",
  flat,
  mask: new Uint8Array(flat.width * flat.height).fill(255),
  stepMm: STEP,
  originMm: { x: FRAME.originX, y: FRAME.originY },
  datumMm: { x: 0, y: 100 },
  sourcePxPerMm: 4,
  colours: colours(hexes),
});

const flatOf = async (pattern: KnownPattern) =>
  renderFlat(drawKnown(pattern, { minX: FRAME.originX - 100, minY: FRAME.originY - 100, maxX: FRAME.originX + FRAME.width * STEP + 100, maxY: FRAME.originY + FRAME.height * STEP + 100 }), FRAME, pattern.ground);

const DOTS: KnownPattern = { generatorId: "kit-dots", params: { dotWidthMm: 16, pitchMm: 36, rowStepMm: 18, halfDrop: true }, colours: ["#ffffff"], ground: "#c8102e" };

const STRIPES: KnownPattern = { generatorId: "stripe-variations", params: { rhythm: 0, width: 20, angle: 45, grow: 0.5 }, colours: ["#ffffff"], ground: "#c8102e", datum: { x: 7, y: 11 } };
const CAMO: KnownPattern = { generatorId: "camo", params: { scale: 60 }, colours: ["#2f5d34", "#6b8f3a", "#c8b27a"], ground: "#2f5d34", seed: 7 };
const GREENS = ["#2f5d34", "#6b8f3a", "#c8b27a"];
const RED_WHITE = ["#c8102e", "#ffffff"];

const within = (found: unknown, truth: number, share: number): void => expect(Math.abs(Number(found) - truth) / truth).toBeLessThanOrEqual(share);
const fresh = () => createPatternStage({ budget: createMatchBudget() });
const camoTiled = async () => {
  const base = await renderFlat(drawKnown(CAMO, { minX: 0, minY: 0, maxX: 300, maxY: 300 }), { width: 50, height: 50, step: 6, originX: 0, originY: 0 }, CAMO.ground);
  return repeatTile(base, { width: 50, height: 50 }, { width: FRAME.width, height: FRAME.height });
};

describe("pattern stage", () => {
  it("reads polka dots as the dots style, with settings and repeat close to the truth", async () => {
    const out = await fresh().find(inputFor(await flatOf(DOTS), RED_WHITE));
    if (out === null || out.layer.kind !== "pattern") throw new Error("expected a pattern");
    expect(out.kind).toBe("generator");
    expect(out.layer.generatorId).toBe("kit-dots");
    within(out.layer.params.dotWidthMm, 16, 0.1);
    within(out.layer.params.pitchMm, 36, 0.05);
    within(out.layer.params.rowStepMm, 18, 0.05);
    expect(out.layer.params.halfDrop).toBe(true);
    within(out.repeat?.widthMm, 36, 0.1);
    within(out.repeat?.heightMm, 36, 0.1);
    expect(out.repeat?.label).toBe("estimated, check it");
    expect(out.match.error).toBeLessThanOrEqual(0.15);
    expect(out.layer.colourIds).toEqual(["colour-2"]);
    expect(out.note).toMatch(/Polka dots.*under the 15% limit/);
    expect(out.note).toMatch(/follows the pattern piece/);
  });

  it("keeps the repeating picture as the alternative, not drawn, with its cut", async () => {
    const out = await fresh().find(inputFor(await flatOf(DOTS), RED_WHITE));
    expect(out?.alternative).toMatchObject({ kind: "image-fill", opacity: 0, mode: "tile", assetId: "tile-front", id: "pattern-front-alt" });
    expect(out?.cuts).toHaveLength(1);
    expect(out?.cuts[0]).toMatchObject({ assetId: "tile-front", clip: false, view: "front" });
    expect(out?.dpiWarning).toMatch(/dpi/);
    expect(out?.effectiveDpi).toBeCloseTo(101.6, 1);
  });

  it("reads diagonal stripes as a second style, with the start of the pattern in the datum", async () => {
    const out = await fresh().find(inputFor(await flatOf(STRIPES), RED_WHITE));
    if (out === null || out.layer.kind !== "pattern") throw new Error("expected a pattern");
    expect(out.layer.generatorId).toBe("stripe-variations");
    within(out.layer.params.width, 20, 0.1);
    expect(Math.abs(Number(out.layer.params.angle) - 45)).toBeLessThanOrEqual(4);
    within(out.repeat?.widthMm, 56.6, 0.1);
    expect(out.layer.datum.offsetMm).not.toEqual({ x: 0, y: 0 });
    expect(out.note).toMatch(/read from the picture/);
  });

  it("reads straight stripes, which repeat along one axis only", async () => {
    const out = await fresh().find(inputFor(await flatOf({ ...STRIPES, params: { ...STRIPES.params, angle: 90 } }), RED_WHITE));
    if (out === null || out.layer.kind !== "pattern") throw new Error("expected a pattern");
    expect(out.layer.params.angle).toBe(90);
    within(out.repeat?.widthMm, 40, 0.1);
    expect(out.repeat?.heightMm).toBeNull();
    expect(out.note).toMatch(/cm across \(estimated/);
    expect(out.cuts[0].area.maxY - out.cuts[0].area.minY).toBeGreaterThan(0);
  });

  it("proposes a repeating picture when no style fits closely, and says how close the nearest came", async () => {
    const out = await fresh().find(inputFor(await camoTiled(), GREENS));
    expect(out).toMatchObject({ kind: "tile", alternative: null });
    expect(out?.layer).toMatchObject({ kind: "image-fill", mode: "tile", assetId: "tile-front", opacity: 1 });
    expect(out?.match.error).toBeGreaterThan(0.15);
    expect(out?.note).toMatch(/closest of our styles.*over the 15% limit/);
    within(out?.repeat?.widthMm, 75, 0.1);
    expect(out?.note).toMatch(/seamless/);
  });

  it("proposes one full-panel picture when there is no repeat but the garment is busy", async () => {
    const out = await fresh().find(inputFor(await flatOf(CAMO), GREENS));
    expect(out).toMatchObject({ kind: "panel", repeat: null, alternative: null });
    expect(out?.layer).toMatchObject({ kind: "image-fill", mode: "panel", assetId: "panel-front" });
    expect(out?.cuts[0].clip).toBe(true);
  });

  it("proposes nothing for a plain garment, plain blocks of colour, one colour, or a block too small", async () => {
    const plain = await renderFlat({ shapes: [] }, FRAME, "#c8102e");
    expect(await fresh().find(inputFor(plain, RED_WHITE))).toBeNull();
    const blocks = await renderFlat({ shapes: [{ kind: "polygon", fill: "#ffffff", points: [{ x: -180, y: 0 }, { x: 180, y: 0 }, { x: 180, y: 120 }, { x: -180, y: 120 }] }] }, FRAME, "#c8102e");
    expect(await fresh().find(inputFor(blocks, RED_WHITE))).toBeNull();
    expect(await fresh().find(inputFor(plain, ["#c8102e"]))).toBeNull();
    const small = { ...inputFor(plain, RED_WHITE), mask: new Uint8Array(plain.width * plain.height).fill(0) };
    expect(await fresh().find(small)).toBeNull();
  });

  it("stops at its budget and says so, keeping what it found", async () => {
    const budget = createMatchBudget({ renders: 2, comparisons: 60_000_000, milliseconds: 5000 });
    const found = await createPatternStage({ budget }).find(inputFor(await flatOf(DOTS), RED_WHITE));
    expect(found?.kind).toBe("generator");
    expect(found?.note).toMatch(/stopped at its limit/);
    expect(budget.spent()).toMatchObject({ renders: 2, stoppedEarly: true });
    const none = await createPatternStage({ budget: createMatchBudget({ renders: 0, comparisons: 1, milliseconds: 1 }) }).find(inputFor(await camoTiled(), GREENS));
    expect(none).toMatchObject({ kind: "tile", match: { generatorId: null } });
  });

  it("tries no style it cannot find", async () => {
    const out = await createPatternStage({ budget: createMatchBudget(), lookup: () => undefined }).find(inputFor(await flatOf(DOTS), RED_WHITE));
    expect(out).toMatchObject({ kind: "tile", match: { generatorId: null, error: null } });
    expect(out?.note).toMatch(/None of our styles could be read/);
  });

  it("gives the same answer every time", async () => {
    const flat = await flatOf(DOTS);
    const [one, two] = [await fresh().find(inputFor(flat, RED_WHITE)), await fresh().find(inputFor(flat, RED_WHITE))];
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });
});
