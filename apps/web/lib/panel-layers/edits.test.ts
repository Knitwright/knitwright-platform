import { describe, expect, it } from "vitest";
import { FIXTURE_STACK } from "./fixtures/stack";
import { fromFabric } from "./from-fabric";
import { toFabric } from "./to-fabric";
import type { FabricDocJson, FabricObjectJson, PanelFrame } from "./fabric-types";
import { addTextLayer, moveLayer, removeLayer } from "./edit";

const FRAME: PanelFrame = { centre: { x: 0, y: 0 }, size: { w: 500, h: 700 } };
const doc = (): FabricDocJson => toFabric(FIXTURE_STACK, "front", FRAME);
const change = (d: FabricDocJson, id: string, patch: Partial<FabricObjectJson>): FabricDocJson => ({
  ...d,
  objects: d.objects.map((o) => (o.kw.layer.id === id ? ({ ...o, ...patch } as FabricObjectJson) : o)),
});
const layerOf = (result: ReturnType<typeof fromFabric>, id: string) => {
  if (!result.ok) throw new Error(result.reason);
  const found = result.stack.layers.find((l) => l.id === id);
  if (!found) throw new Error("missing");
  return found;
};

describe("edits made in Fabric come back as stack changes", () => {
  it("moves a graphic", () => {
    const next = fromFabric(FIXTURE_STACK, "front", change(doc(), "crest", { left: 100.126, top: -20 }), FRAME);
    expect(layerOf(next, "crest")).toMatchObject({ offsetMm: { x: 100.13, y: -20 } });
  });

  it("resizes a graphic by scale and turns it, wrapping the angle into 0 to 360", () => {
    const next = fromFabric(FIXTURE_STACK, "front", change(doc(), "crest", { scaleX: 2, scaleY: 0.5, angle: -90 }), FRAME);
    expect(layerOf(next, "crest")).toMatchObject({ widthMm: 180, heightMm: 50, rotationDeg: 270 });
    const wrapped = fromFabric(FIXTURE_STACK, "front", change(doc(), "crest", { angle: 725 }), FRAME);
    expect(layerOf(wrapped, "crest")).toMatchObject({ rotationDeg: 5 });
    const whole = fromFabric(FIXTURE_STACK, "front", change(doc(), "crest", { angle: 359.999 }), FRAME);
    expect(layerOf(whole, "crest")).toMatchObject({ rotationDeg: 0 });
  });

  it("edits the words and the size of a text layer", () => {
    const edited = change(doc(), "sponsor", { text: "NEW SPONSOR", fontSize: 20, scaleX: 1.5, width: 200 });
    const next = fromFabric(FIXTURE_STACK, "front", edited, FRAME);
    expect(layerOf(next, "sponsor")).toMatchObject({ text: "NEW SPONSOR", heightMm: 20, widthMm: 300 });
  });

  it("keeps a graphic with no height as it was until its height is changed", () => {
    const open = { ...FIXTURE_STACK, layers: FIXTURE_STACK.layers.map((l) => (l.id === "crest" && l.kind === "graphic" ? { ...l, heightMm: undefined } : l)) };
    const d = toFabric(open, "front", FRAME);
    expect(layerOf(fromFabric(open, "front", d, FRAME), "crest")).not.toHaveProperty("heightMm", expect.anything());
    const taller = { ...d, objects: d.objects.map((o) => (o.kw.layer.id === "crest" ? { ...o, scaleY: 2 } : o)) };
    expect(layerOf(fromFabric(open, "front", taller, FRAME), "crest")).toMatchObject({ heightMm: 180 });
  });

  it("takes opacity and clamps it", () => {
    expect(layerOf(fromFabric(FIXTURE_STACK, "front", change(doc(), "crest", { opacity: 0.25 }), FRAME), "crest")).toMatchObject({ opacity: 0.25 });
    expect(layerOf(fromFabric(FIXTURE_STACK, "front", change(doc(), "crest", { opacity: 4 }), FRAME), "crest")).toMatchObject({ opacity: 1 });
    expect(layerOf(fromFabric(FIXTURE_STACK, "front", change(doc(), "crest", { opacity: -1 }), FRAME), "crest")).toMatchObject({ opacity: 0 });
  });

  it("never moves a fill or a player mark, even if the canvas says it moved", () => {
    const moved = change(change(doc(), "ground-front", { left: 99 }), "photo", { left: 99, angle: 80 });
    const next = fromFabric(FIXTURE_STACK, "front", moved, FRAME);
    expect(layerOf(next, "ground-front")).toEqual(FIXTURE_STACK.layers[0]);
    expect(layerOf(next, "photo")).toEqual(FIXTURE_STACK.layers.find((l) => l.id === "photo"));
  });

  it("follows the canvas order and leaves other views where they are", () => {
    const d = doc();
    const reordered = { ...d, objects: [d.objects[0], d.objects[3], d.objects[1], d.objects[2], d.objects[4]] as FabricObjectJson[] };
    const next = fromFabric(FIXTURE_STACK, "front", reordered, FRAME);
    expect(next.ok && next.stack.layers.map((l) => l.id)).toEqual(["ground-front", "crest", "hoops", "photo", "sponsor", "mark-back-number"]);
  });

  it("removes a layer deleted from the canvas and refuses an object it did not make", () => {
    const d = doc();
    const without = { ...d, objects: d.objects.filter((o) => o.kw.layer.id !== "crest") };
    expect(fromFabric(FIXTURE_STACK, "front", without, FRAME)).toMatchObject({ ok: true });
    const stranger = { ...d, objects: [...d.objects, { ...d.objects[3], kw: undefined } as unknown as FabricObjectJson] };
    expect(fromFabric(FIXTURE_STACK, "front", stranger, FRAME)).toMatchObject({ ok: false });
    const untagged = { ...d, objects: [...d.objects, { ...d.objects[3], kw: { layer: d.objects[3].kw.layer } } as unknown as FabricObjectJson] };
    expect(fromFabric(FIXTURE_STACK, "front", untagged, FRAME)).toMatchObject({ ok: false });
    const wrongId = { ...d, objects: [...d.objects, { ...d.objects[3], kw: { ...d.objects[3].kw, layer: { ...d.objects[3].kw.layer, id: "other-view" } } }] };
    // A copy made on the canvas keeps its tag and is a new layer.
    expect(fromFabric(FIXTURE_STACK, "front", wrongId, FRAME)).toMatchObject({ ok: true });
    const duplicate = { ...d, objects: [...d.objects, d.objects[3]] };
    expect(fromFabric(FIXTURE_STACK, "front", duplicate, FRAME)).toMatchObject({ ok: false });
  });

  it("refuses a canvas that makes the stack meaningless", () => {
    const d = doc();
    const groundOnTop = { ...d, objects: [...d.objects.slice(1), d.objects[0]] };
    const next = fromFabric(FIXTURE_STACK, "front", groundOnTop, FRAME);
    expect(next.ok).toBe(false);
  });

  it("refuses a layer the stack's rules refuse", () => {
    const next = fromFabric(FIXTURE_STACK, "front", change(doc(), "sponsor", { text: "" }), FRAME);
    expect(next).toMatchObject({ ok: false });
  });
});

describe("stack edits that do not go through the canvas", () => {
  it("adds a text layer on top of the view, with an id that is free", () => {
    const once = addTextLayer(FIXTURE_STACK, "front", "Hello");
    const twice = addTextLayer(once, "front", "Again");
    const ids = twice.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(twice.layers.at(-1)).toMatchObject({ kind: "text", text: "Again", views: ["front"], provenance: "user-edited" });
    expect(FIXTURE_STACK.layers).toHaveLength(6);
  });

  it("removes a layer by id and leaves the original alone", () => {
    const next = removeLayer(FIXTURE_STACK, "crest");
    expect(next.layers.map((l) => l.id)).not.toContain("crest");
    expect(FIXTURE_STACK.layers.map((l) => l.id)).toContain("crest");
  });
});

describe("moving a layer up or down inside a view", () => {
  const ids = (layers: readonly { id: string }[]) => layers.map((l) => l.id);

  it("swaps with the next layer of the same view, skipping layers of other views", () => {
    const up = moveLayer(FIXTURE_STACK, "front", "crest", "up");
    expect(ids(up.layers)).toEqual(["ground-front", "hoops", "photo", "sponsor", "crest", "mark-back-number"]);
    const down = moveLayer(FIXTURE_STACK, "front", "crest", "down");
    expect(ids(down.layers)).toEqual(["ground-front", "hoops", "crest", "photo", "sponsor", "mark-back-number"]);
  });

  it("does nothing at the top or bottom of the view, or for a layer that is not on it", () => {
    expect(moveLayer(FIXTURE_STACK, "front", "sponsor", "up")).toBe(FIXTURE_STACK);
    expect(moveLayer(FIXTURE_STACK, "front", "ground-front", "down")).toBe(FIXTURE_STACK);
    expect(moveLayer(FIXTURE_STACK, "front", "mark-back-number", "up")).toBe(FIXTURE_STACK);
  });

  it("swaps with the next layer of that view even when layers of other views lie between", () => {
    const between = moveLayer(FIXTURE_STACK, "back", "hoops", "up");
    expect(ids(between.layers)).toEqual(["ground-front", "mark-back-number", "photo", "crest", "sponsor", "hoops"]);
  });
});
