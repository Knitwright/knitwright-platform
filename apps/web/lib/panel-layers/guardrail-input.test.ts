import { describe, expect, it } from "vitest";
import { runGuardrails } from "@/lib/guardrails";
import { FIXTURE_PANEL, FIXTURE_STACK } from "./fixtures/stack";
import { frameOf } from "./geometry";
import { guardrailInput, layerChecks } from "./guardrail-input";
import { toFabric } from "./to-fabric";
import type { FabricDocJson, FabricObjectJson } from "./fabric-types";

const FRAME = frameOf(FIXTURE_PANEL.cutOutline);
const doc = (): FabricDocJson => toFabric(FIXTURE_STACK, "front", FRAME);
const move = (d: FabricDocJson, id: string, patch: Partial<FabricObjectJson>): FabricDocJson => ({
  ...d,
  objects: d.objects.map((o) => (o.kw.layer.id === id ? ({ ...o, ...patch } as FabricObjectJson) : o)),
});

describe("the canvas as guardrail input", () => {
  it("makes one placed item per layer that has a place, on the panel, with boxes in panel millimetres", () => {
    const input = guardrailInput(FIXTURE_STACK, doc(), FIXTURE_PANEL, {});
    expect(input.items.map((i) => [i.id, i.kind, i.panelId])).toEqual([
      ["ground-front", "fill", "front"],
      ["hoops", "fill", "front"],
      ["photo", "fill", "front"],
      ["crest", "raster", "front"],
      ["sponsor", "text", "front"],
    ]);
    const crest = input.items.find((i) => i.id === "crest");
    expect((crest?.box.x1 ?? 0) - (crest?.box.x0 ?? 0)).toBeGreaterThan(90);
    expect(input.panels).toEqual([FIXTURE_PANEL]);
  });

  it("turns the box with the layer", () => {
    const flat = guardrailInput(FIXTURE_STACK, move(doc(), "crest", { angle: 0 }), FIXTURE_PANEL, {}).items.find((i) => i.id === "crest");
    const turned = guardrailInput(FIXTURE_STACK, move(doc(), "crest", { angle: 45 }), FIXTURE_PANEL, {}).items.find((i) => i.id === "crest");
    expect(flat?.box).toEqual({ x0: 60 - 45, y0: -80 - 50, x1: 60 + 45, y1: -80 + 50 });
    expect((turned?.box.x1 ?? 0) - (turned?.box.x0 ?? 0)).toBeCloseTo(((90 + 100) * Math.SQRT1_2), 5);
  });

  it("lets a ground and a pattern reach the bleed but stops a contained panel picture at the cut", () => {
    const input = guardrailInput(FIXTURE_STACK, doc(), FIXTURE_PANEL, {});
    const box = (id: string) => input.items.find((i) => i.id === id)?.box;
    expect(box("ground-front")).toEqual({ x0: -260, y0: -360, x1: 260, y1: 360 });
    expect(input.items.filter((i) => i.kind === "fill")).toHaveLength(3);
    expect(box("photo")).toEqual(box("ground-front"));
    const contained = { ...FIXTURE_STACK, layers: FIXTURE_STACK.layers.map((l) => (l.kind === "image-fill" ? { ...l, mode: "panel" as const, fit: "contain" as const } : l)) };
    const next = guardrailInput(contained, toFabric(contained, "front", FRAME), FIXTURE_PANEL, {});
    expect(next.items.find((i) => i.id === "photo")?.box).toEqual({ x0: -250, y0: -350, x1: 250, y1: 350 });
  });

  it("uses the pixel width of a known picture and lists the colours the view uses", () => {
    const input = guardrailInput(FIXTURE_STACK, doc(), FIXTURE_PANEL, { "asset-2": { kind: "raster", widthPx: 300 } });
    expect(input.items.find((i) => i.id === "crest")).toMatchObject({ kind: "raster", widthPx: 300 });
    expect(input.colours.map((c) => c.hex)).toEqual(["#1b2a49", "#d4af37", "#ffffff"]);
  });

  it("finds a soft picture and a seam-crossing picture live, and nothing in the made-up design when it sits inside", () => {
    const soft = layerChecks(FIXTURE_STACK, doc(), FIXTURE_PANEL, { "asset-2": { kind: "raster", widthPx: 300 } });
    expect(soft.map((f) => f.code)).toContain("min-dpi");
    const dragged = layerChecks(FIXTURE_STACK, move(doc(), "crest", { left: 240 }), FIXTURE_PANEL, {});
    expect(dragged.some((f) => f.code === "seam-cross" && f.itemId === "crest")).toBe(true);
    expect(layerChecks(FIXTURE_STACK, doc(), FIXTURE_PANEL, {}).filter((f) => f.itemId === "crest")).toEqual([]);
  });

  it("raises no bleed finding for a ground and pattern on a curved panel, because they reach the bleed region", () => {
    const round = { ...FIXTURE_PANEL, cutOutline: Array.from({ length: 120 }, (_, i) => [250 * Math.cos((i / 120) * 2 * Math.PI), 350 * Math.sin((i / 120) * 2 * Math.PI)] as [number, number]), sewLine: null };
    const found = layerChecks(FIXTURE_STACK, doc(), round, {});
    expect(found.filter((f) => f.code === "bleed-short")).toEqual([]);
  });

  it("is the same answer as running the guardrails on the input", () => {
    const input = guardrailInput(FIXTURE_STACK, doc(), FIXTURE_PANEL, {});
    expect(layerChecks(FIXTURE_STACK, doc(), FIXTURE_PANEL, {})).toEqual(runGuardrails(input));
  });
});
