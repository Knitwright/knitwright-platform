import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { DEFAULT_PRINT_TYPE, elementSummaries, elementViews } from "./elements";
import { garmentNamesNumbers } from "./garment";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const withCrest = (): GarmentSpec =>
  apply(start("crew-tee"), {
    type: "add-artwork",
    artwork: {
      id: "crest",
      name: "Club crest",
      source: { kind: "text", text: "FC" },
      panelId: "body-front",
      anchor: "left-chest",
      offsetX: 100,
      offsetY: -50,
      width: 800,
      height: 400,
      rotationDegrees: 10,
      technique: "embroidery",
      provenance: "user-edited",
    },
  });

describe("the elements of a garment", () => {
  it("lists no element on a plain garment: its ground colours are the panels' own", () => {
    expect(elementSummaries(start("crew-tee"))).toEqual([]);
  });

  it("lists a text layer with its placement in mm from its anchor, its size and its print type", () => {
    const spec = withCrest();
    const summaries = elementSummaries(spec);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ kind: "text", name: "Club crest" });
    const view = elementViews(spec)[summaries[0].id];
    expect(view.kind).toBe("text");
    expect(view.text).toBe("FC");
    expect(view.placement).toMatch(/^Anchor: left-chest/);
    expect(view.offset).not.toBeNull();
    expect(view.widthMm).toBeGreaterThan(0);
    expect(view.printType).toBe("Embroidery");
    expect(view.opacity).toBe(100);
    expect(view.views).toBe("Front");
  });

  it("lists the names and numbers as player marks, sublimated unless they say otherwise", () => {
    const marks = garmentNamesNumbers(start("crew-tee"));
    if (!marks.turnOn) return;
    const spec = apply(start("crew-tee"), marks.turnOn as SpecAction);
    const players = elementSummaries(spec).filter((one) => one.kind === "player-mark");
    expect(players.length).toBeGreaterThan(0);
    const view = elementViews(spec)[players[0].id];
    expect(view.placement).toMatch(/^Anchor: /);
    expect(view.printType).toBe(DEFAULT_PRINT_TYPE);
  });
});
