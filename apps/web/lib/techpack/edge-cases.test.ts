import { describe, expect, it } from "vitest";
import { designWith } from "@/lib/flat/fixtures/designs";
import type { FlatModel } from "@/lib/flat/model";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { buildArtwork } from "./artwork";
import { buildColourways } from "./colourways";
import { completenessReport } from "./completeness";
import { buildCover } from "./cover";
import { withCalloutCodes } from "./flats";
import { CHARTS, packFor } from "./fixtures/designs";
import { panelLabelOf } from "./labels";
import { listOf, sentenceCase } from "./text";
import type { TechPackInput } from "./input";

const input = (spec: GarmentSpec): TechPackInput => ({
  project: { name: "Club shirt", styleNumber: "A", season: "B", brandName: "C" },
  version: 1,
  versionDate: "1 Jan 2030",
  versionDateIso: "2030-01-01",
  printedOn: "2 Jan 2030",
  printedOnIso: "2030-01-02",
  history: [],
  spec,
  flats: { front: null, back: null },
});

describe("panelLabelOf", () => {
  it("gives the label of a panel, and the id when the garment has no such panel", () => {
    expect(panelLabelOf(start("crew-tee"), "body-front")).toBe("Body front");
    expect(panelLabelOf(start("crew-tee"), "wing")).toBe("wing");
    expect(panelLabelOf({ typeId: "kilt" }, "body-front")).toBe("body-front");
  });
});

describe("text helpers", () => {
  it("joins words the way a sentence does", () => {
    expect(listOf([])).toBe("");
    expect(listOf(["a"])).toBe("a");
    expect(listOf(["a", "b"])).toBe("a and b");
    expect(listOf(["a", "b", "c"])).toBe("a, b and c");
    expect(sentenceCase("the value")).toBe("The value");
  });
});

describe("a design that no longer matches the registry", () => {
  it("shows an option with no choice, or an unknown choice, as to be confirmed", () => {
    const spec = start("polo");
    const damaged = { ...spec, options: { ...spec.options, fit: { choiceId: "gone", provenance: "user-edited" as const } } };
    const { fit } = Object.fromEntries(buildCover(input(damaged)).options.map((option) => [option.id, option.choice]));
    expect(fit).toEqual({ status: "to-be-confirmed" });
    const { collar: _dropped, ...fewer } = spec.options;
    void _dropped;
    const missing = buildCover(input({ ...spec, options: fewer })).options.find((option) => option.id === "collar");
    expect(missing?.choice).toEqual({ status: "to-be-confirmed" });
  });

  it("shows an unknown garment type as to be confirmed on the cover", () => {
    const cover = buildCover(input({ ...start("polo"), typeId: "kilt" }));
    expect(cover.garmentType).toEqual({ status: "to-be-confirmed" });
    expect(cover.options).toEqual([]);
  });

  it("names a place on artwork by its id when the garment has no such place", () => {
    const spec = start("crew-tee");
    const stray = {
      ...spec,
      artwork: [
        {
          id: "crest",
          name: "Crest",
          source: { kind: "text" as const, text: "FC" },
          panelId: "body-front",
          anchor: "nowhere",
          offsetX: 0,
          offsetY: 0,
          width: 500,
          height: 500,
          rotationDegrees: 0,
          technique: "transfer" as const,
          provenance: "user-edited" as const,
        },
      ],
    };
    expect(buildArtwork(stray).items[0]?.anchor).toEqual({ status: "set", value: "nowhere", provenance: "user-edited" });
  });

  it("leaves a panel that has no colour entry as to be confirmed in a colourway that colours another", () => {
    const result = applyAction(start("crew-tee"), {
      type: "update-colourway",
      colourway: { id: "main", name: "Home", colours: [{ panelId: "body-front", colour: "Red", provenance: "user-edited" }] },
    });
    if (!result.ok) throw new Error(result.reason);
    const rows = buildColourways(result.spec).colourways[0]?.rows ?? [];
    expect(rows[0]?.code.status).toBe("set");
    expect(rows[0]?.screenColour.status).toBe("to-be-confirmed");
    expect(rows[1]?.code.status).toBe("to-be-confirmed");
  });
});

describe("withCalloutCodes", () => {
  it("leaves alone text and lines in the callout layer that do not start with a known label", () => {
    const model = {
      layers: [
        {
          id: "measurements",
          label: "Measurements",
          elements: [
            { kind: "text", text: "Mystery 1.0 cm", at: { x: 0, y: 0 }, size: 1, anchor: "start", colour: "#000000", rotation: 0 },
            { kind: "path", name: "Mystery line", panelId: null, commands: [], fill: null, stroke: null },
            { kind: "path", name: "Outline", panelId: null, commands: [], fill: null, stroke: null },
          ],
        },
      ],
    } as unknown as FlatModel;
    const coded = withCalloutCodes(model, [{ pointId: "chest-width", code: "A", label: "Chest width" }], new Map([["chest-width", 100]]));
    expect(coded).toEqual(model);
  });

  it("renames the line of a callout as well as its text", () => {
    const model = {
      layers: [
        {
          id: "measurements",
          label: "Measurements",
          elements: [{ kind: "path", name: "Chest width line", panelId: null, commands: [], fill: null, stroke: null }],
        },
      ],
    } as unknown as FlatModel;
    const coded = withCalloutCodes(model, [{ pointId: "chest-width", code: "A", label: "Chest width" }], new Map());
    expect(coded.layers[0]?.elements[0]).toMatchObject({ name: "A line" });
  });
});

describe("the completeness report", () => {
  it("says the value is missing alone when only the values are missing and the tolerance is known", () => {
    const sized = applyAction(designWith("crew-tee", {}), {
      type: "set-sizing",
      sizing: { sizes: ["U3", "X"], baseSize: "U3" },
    });
    if (!sized.ok) throw new Error(sized.reason);
    const item = completenessReport(packFor(sized.spec, { charts: CHARTS })).sections
      .find((section) => section.id === "measurements")
      ?.items.find((entry) => entry.label === "Chest width");
    expect(item?.detail).toBe("The value for size X");
  });

  it("finds a brand, a design name, a garment type and a wearer to confirm when they are missing", () => {
    const pack = packFor(start("crew-tee"), {
      project: { name: "", styleNumber: "A", season: "B", brandName: "" },
    });
    const labels = completenessReport(pack).sections[0]?.items.map((entry) => entry.label);
    expect(labels).toEqual(expect.arrayContaining(["Brand", "Design name"]));
  });
});
