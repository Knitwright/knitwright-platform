import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { packFor } from "@/lib/techpack/fixtures/designs";
import {
  codeField,
  colourwayFormAction,
  colourwayFormRows,
  measurementFormActions,
  measurementFormRows,
  screenField,
  type MeasurementFormRow,
} from "./tech-pack-value-forms";

const USER = "user-edited";

const apply = (spec: GarmentSpec, ...actions: object[]): GarmentSpec =>
  actions.reduce<GarmentSpec>((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, spec);

const sized = () => apply(start("crew-tee"), { type: "set-sizing", sizing: { sizes: ["S", "M", "L"], baseSize: "M" } });

const chestOf = (spec: GarmentSpec): MeasurementFormRow => {
  const row = measurementFormRows(spec, packFor(spec)).find((entry) => entry.pointId === "chest-width");
  if (!row) throw new Error("No chest width.");
  return row;
};

describe("measurementFormRows", () => {
  it("gives a field for each size, the base size named, and one for the tolerance", () => {
    const row = chestOf(sized());
    expect(row.values.map((field) => [field.name, field.label, field.size])).toEqual([
      ["value-0", "Chest width at size S, in centimetres", "S"],
      ["value-1", "Chest width at size M, the base size, in centimetres", null],
      ["value-2", "Chest width at size L, in centimetres", "L"],
    ]);
    expect(row.tolerance).toMatchObject({ name: "tolerance", text: "", own: false });
  });

  it("gives one field when the design has no sizes yet", () => {
    expect(chestOf(start("crew-tee")).values).toEqual([
      { name: "value-0", label: "Chest width, in centimetres", text: "", tenthsMm: null, own: false, size: null },
    ]);
  });

  it("shows the values in centimetres and knows which the person typed", () => {
    const spec = apply(
      sized(),
      { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: USER },
      { type: "set-size-measurement", entry: { pointId: "chest-width", size: "L", value: 5500, provenance: USER } },
      { type: "set-tolerance", entry: { pointId: "chest-width", value: 100, provenance: USER } },
    );
    const row = chestOf(spec);
    expect(row.values.map((field) => [field.text, field.own])).toEqual([
      ["", false],
      ["52.5", true],
      ["55", true],
    ]);
    expect(row.tolerance).toMatchObject({ text: "1", own: true });
  });
});

describe("measurementFormActions", () => {
  it("sets the base size, another size and the tolerance, and leaves an empty field alone", () => {
    const result = measurementFormActions(chestOf(sized()), { "value-0": "", "value-1": "52,5", "value-2": "55", tolerance: "±1" });
    expect(result).toEqual({
      ok: true,
      actions: [
        { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: USER },
        { type: "set-size-measurement", entry: { pointId: "chest-width", size: "L", value: 5500, provenance: USER } },
        { type: "set-tolerance", entry: { pointId: "chest-width", value: 100, provenance: USER } },
      ],
    });
  });

  it("removes the person's own values when their fields are emptied, and sends nothing for an unchanged value", () => {
    const spec = apply(
      sized(),
      { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: USER },
      { type: "set-size-measurement", entry: { pointId: "chest-width", size: "L", value: 5500, provenance: USER } },
      { type: "set-tolerance", entry: { pointId: "chest-width", value: 100, provenance: USER } },
    );
    expect(measurementFormActions(chestOf(spec), { "value-1": "", "value-2": "", tolerance: "+/- 1" })).toEqual({
      ok: true,
      actions: [
        { type: "remove-measurement", pointId: "chest-width" },
        { type: "remove-size-measurement", pointId: "chest-width", size: "L" },
      ],
    });
    expect(measurementFormActions(chestOf(spec), { "value-1": "52.50", "value-2": "55", tolerance: "" })).toEqual({
      ok: true,
      actions: [{ type: "remove-tolerance", pointId: "chest-width" }],
    });
  });

  it("names each field that is not a length, and sends nothing", () => {
    const result = measurementFormActions(chestOf(sized()), { "value-0": "wide", "value-1": "52", tolerance: "a bit" });
    expect(result).toEqual({
      ok: false,
      errors: { "value-0": "Enter a length in centimetres, such as 52.5.", tolerance: "Enter a length in centimetres, such as 52.5." },
    });
  });
});

describe("colourway forms", () => {
  it("give a colour code and a screen colour for each part of each colourway", () => {
    const spec = apply(start("crew-tee"), {
      type: "update-colourway",
      colourway: { id: "main", name: "Home", colours: [{ panelId: "body-front", colour: "Navy", swatch: "#1b2a49", provenance: USER }] },
    });
    const [row] = colourwayFormRows(spec);
    expect(row?.panels[0]).toEqual({ panelId: "body-front", label: "Body front", code: "Navy", screen: "#1b2a49" });
    expect(row?.panels[1]).toMatchObject({ code: "", screen: "" });
  });

  it("build the whole colourway from what was typed, and leave out a part with nothing", () => {
    const spec = start("crew-tee");
    const result = colourwayFormAction(spec, "main", { [codeField("body-front")]: " Navy 19-4052 ", [screenField("body-front")]: "1B2A49" });
    expect(result).toEqual({
      ok: true,
      action: {
        type: "update-colourway",
        colourway: { id: "main", name: spec.colourways[0].name, colours: [{ panelId: "body-front", colour: "Navy 19-4052", swatch: "#1b2a49", provenance: USER }] },
      },
    });
  });

  it("send nothing when nothing changed, and name a screen colour that is not one", () => {
    const spec = start("crew-tee");
    expect(colourwayFormAction(spec, "main", {})).toEqual({ ok: true, action: null });
    expect(colourwayFormAction(spec, "main", { [screenField("body-back")]: "red" })).toEqual({
      ok: false,
      errors: { [screenField("body-back")]: "Write the screen colour as # and six letters or numbers, such as #1b2a49, or leave it empty." },
    });
  });

  it("say so when the colourway is gone", () => {
    expect(colourwayFormAction(start("crew-tee"), "gone", {})).toEqual({
      ok: false,
      errors: { form: "This colourway is no longer in the design. Reload the page." },
    });
  });

  it("refuse a code that is too long, with the reason", () => {
    const result = colourwayFormAction(start("crew-tee"), "main", { [codeField("body-front")]: "x".repeat(200) });
    expect(result.ok).toBe(false);
  });
});
