import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { layerSchema, type Layer } from "@/lib/artwork-stack";
import { FIXTURE_STACK } from "./fixtures/stack";
import { fromFabric } from "./from-fabric";
import { toFabric } from "./to-fabric";
import type { PanelFrame } from "./fabric-types";

const FRAME: PanelFrame = { centre: { x: 12.5, y: -30 }, size: { w: 500, h: 700 } };
const send = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const common = { views: ["front"], blend: "normal", provenance: "user-edited" } as const;

const mm = fc.integer({ min: -400000, max: 400000 }).map((n) => n / 100);
const size = fc.integer({ min: 1, max: 100000 }).map((n) => n / 100);
const opacity = fc.integer({ min: 0, max: 100 }).map((n) => n / 100);
const angle = fc.integer({ min: 0, max: 35999 }).map((n) => n / 100);
const point = fc.record({ x: mm, y: mm });
const word = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{0,30}$/);

const layers: fc.Arbitrary<Layer> = fc.oneof(
  fc.record({ id: fc.constant("g"), kind: fc.constant("ground"), opacity: fc.constant(1), colourId: fc.constant("navy") }),
  fc.record({
    id: fc.constant("p"), kind: fc.constant("pattern"), opacity, generatorId: fc.constant("kit-hoops"),
    params: fc.constant({ size: 40 }), datum: fc.constant({ anchor: "chest-line", offsetMm: { x: 0, y: 0 } }), colourIds: fc.constant(["gold"]),
  }),
  fc.record({
    id: fc.constant("i"), kind: fc.constant("image-fill"), opacity, assetId: fc.constant("asset-1"), mode: fc.constantFrom("tile", "panel"),
    scale: fc.integer({ min: 1, max: 10000 }).map((n) => n / 100), rotationDeg: angle, offsetMm: point, halfDrop: fc.boolean(), fit: fc.constantFrom("cover", "contain"),
  }),
  fc.record({
    id: fc.constant("c"), kind: fc.constant("graphic"), opacity, source: fc.constant({ kind: "asset", assetId: "asset-2" }),
    placement: fc.constant({ kind: "zone", zoneId: "chest" }), offsetMm: point, widthMm: size, heightMm: fc.option(size, { nil: undefined }),
    rotationDeg: angle, clearSpaceMm: fc.constant(5), knockOut: fc.boolean(),
  }),
  fc.record({
    id: fc.constant("t"), kind: fc.constant("text"), opacity, text: word, placement: fc.constant({ kind: "zone", zoneId: "chest" }),
    offsetMm: point, heightMm: size, widthMm: fc.option(size, { nil: undefined }), rotationDeg: angle,
  }),
  fc.record({ id: fc.constant("m"), kind: fc.constant("player-mark"), opacity, place: fc.constantFrom("back-name", "back-number", "front-number", "leg-number") }),
).map((fields) => {
  const clean = Object.fromEntries(Object.entries({ ...common, ...fields }).filter(([, value]) => value !== undefined));
  return layerSchema.parse(clean);
});

describe("the Fabric mapping loses nothing", () => {
  it("round-trips every layer kind of the fixture, through JSON", () => {
    const doc = send(toFabric(FIXTURE_STACK, "front", FRAME));
    const back = fromFabric(FIXTURE_STACK, "front", doc, FRAME);
    expect(back).toEqual({ ok: true, stack: FIXTURE_STACK });
  });

  it("round-trips any single layer exactly", () => {
    fc.assert(
      fc.property(layers, (layer) => {
        const stack = { ...FIXTURE_STACK, layers: [layer.kind === "ground" ? layer : { ...layer, blend: "normal" as const }] };
        const doc = send(toFabric(stack, "front", FRAME));
        const back = fromFabric(stack, "front", doc, FRAME);
        expect(back.ok && back.stack.layers).toEqual(stack.layers);
      }),
      { numRuns: 300 },
    );
  });

  it("round-trips whatever the frame is", () => {
    fc.assert(
      fc.property(mm, mm, (x, y) => {
        const frame = { centre: { x, y }, size: { w: 500, h: 700 } };
        const back = fromFabric(FIXTURE_STACK, "front", send(toFabric(FIXTURE_STACK, "front", frame)), frame);
        expect(back).toEqual({ ok: true, stack: FIXTURE_STACK });
      }),
    );
  });

  it("emits only the layers of the view, in stack order", () => {
    expect(toFabric(FIXTURE_STACK, "front", FRAME).objects.map((o) => o.kw.layer.id)).toEqual(["ground-front", "hoops", "photo", "crest", "sponsor"]);
    expect(toFabric(FIXTURE_STACK, "back", FRAME).objects.map((o) => o.kw.layer.id)).toEqual(["hoops", "mark-back-number"]);
  });
});
