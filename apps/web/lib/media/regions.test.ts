import { describe, expect, it } from "vitest";
import type { FlatElement, FlatModel } from "@/lib/flat/model";
import { protectedRegions } from "./regions";

const model = (artwork: FlatElement[], details: FlatElement[] = []): FlatModel =>
  ({
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    layers: [
      { id: "panels", label: "Panels", elements: [{ kind: "text", text: "ignored", at: { x: 500, y: 500 }, size: 100, anchor: "middle", colour: "#000", rotation: 0 }] },
      { id: "details", label: "Details", elements: details },
      { id: "artwork", label: "Artwork", elements: artwork },
    ],
  }) as unknown as FlatModel;

const image = (rotation: number): FlatElement => ({ kind: "image", fileId: "f", at: { x: 500, y: 500 }, width: 200, height: 100, rotation });
const text = (anchor: "start" | "middle" | "end"): FlatElement => ({ kind: "text", text: "AB", at: { x: 500, y: 500 }, size: 100, anchor, colour: "#000", rotation: 0 });

describe("protectedRegions", () => {
  it("maps a picture onto the square the drawing is fitted to", () => {
    expect(protectedRegions(model([image(0)]), 100)).toEqual([{ x: 40, y: 45, width: 20, height: 10, label: "logo" }]);
  });

  it("covers a turned picture by the circle through its corners", () => {
    const [turned] = protectedRegions(model([image(30)]), 1000);
    expect(turned?.width).toBeGreaterThan(200);
    expect(turned?.height).toBeGreaterThan(100);
  });

  it("places text by its anchor", () => {
    const at = (anchor: "start" | "middle" | "end") => protectedRegions(model([text(anchor)]), 1000)[0]?.x ?? 0;
    expect(at("start")).toBeGreaterThan(at("middle"));
    expect(at("middle")).toBeGreaterThan(at("end"));
  });

  it("takes lettering from the details layer but not its lines, and nothing from other layers", () => {
    const path = { kind: "path", name: "x", panelId: null, commands: [], fill: null, stroke: null } as FlatElement;
    expect(protectedRegions(model([], [text("middle"), path]), 100)).toHaveLength(1);
    expect(protectedRegions(model([path]), 100)).toEqual([]);
  });

  it("keeps a region inside the picture and drops one outside it", () => {
    const outside: FlatElement = { kind: "image", fileId: "f", at: { x: 5000, y: 5000 }, width: 10, height: 10, rotation: 0 };
    const edge: FlatElement = { kind: "image", fileId: "f", at: { x: 1000, y: 0 }, width: 400, height: 400, rotation: 0 };
    const found = protectedRegions(model([outside, edge]), 100);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ x: 80, y: 0, width: 20, height: 20 });
  });
});
