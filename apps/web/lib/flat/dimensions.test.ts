import { describe, expect, it } from "vitest";
import { resolveDimensions } from "./dimensions";
import { SCHEMATIC_CHEST } from "./model";

const PROPORTIONS = { "chest-width": 1, "body-length": 1.5, "sleeve-length": 0.5 };
const NEEDED = [
  { id: "chest-width", label: "Chest width" },
  { id: "body-length", label: "Body length" },
  { id: "sleeve-length", label: "Sleeve length" },
];
const fine = (): string[] => [];

const resolve = (values: Record<string, number>, check: (dims: Readonly<Record<string, number>>) => readonly string[] = fine) =>
  resolveDimensions({ needed: NEEDED, values: new Map(Object.entries(values)), proportions: PROPORTIONS, check });

describe("resolveDimensions", () => {
  it("draws to scale from the measurements when every one is present", () => {
    const result = resolve({ "chest-width": 500, "body-length": 700, "sleeve-length": 240 });
    expect(result.toScale).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.dims).toEqual({ "chest-width": 500, "body-length": 700, "sleeve-length": 240 });
  });

  it("never draws to scale when any measurement is missing, and names what is missing", () => {
    const result = resolve({ "chest-width": 500 });
    expect(result.toScale).toBe(false);
    expect(result.missing).toEqual([
      { pointId: "body-length", label: "Body length" },
      { pointId: "sleeve-length", label: "Sleeve length" },
    ]);
  });

  it("fills a missing measurement from the proportions, using the chest as the anchor", () => {
    const result = resolve({ "chest-width": 400 });
    expect(result.dims["body-length"]).toBe(600);
    expect(result.dims["sleeve-length"]).toBe(200);
  });

  it("still lets a measurement that is present drive the drawing", () => {
    const result = resolve({ "chest-width": 400, "body-length": 900 });
    expect(result.dims["body-length"]).toBe(900);
  });

  it("anchors on another measurement when the chest is missing", () => {
    const result = resolve({ "body-length": 750 });
    expect(result.dims["chest-width"]).toBe(500);
    expect(result.dims["sleeve-length"]).toBe(250);
  });

  it("uses a nominal drawing size, which is never a measurement, when nothing is known", () => {
    const result = resolve({});
    expect(result.dims["chest-width"]).toBe(SCHEMATIC_CHEST);
    expect(result.toScale).toBe(false);
    expect(result.missing).toHaveLength(3);
  });

  it("ignores a measurement the drawing does not use", () => {
    const result = resolve({ "chest-width": 500, "collar-height": 800 });
    expect(result.dims).not.toHaveProperty("collar-height");
  });

  it("falls back to the proportions and says why when the measurements do not fit together", () => {
    const check = (dims: Readonly<Record<string, number>>) =>
      (dims["sleeve-length"] ?? 0) > 400 ? ["The sleeve is longer than the body allows."] : [];
    const values = { "chest-width": 500, "body-length": 700, "sleeve-length": 900 };
    const result = resolve(values, check);
    expect(result.toScale).toBe(false);
    expect(result.problems).toEqual(["The sleeve is longer than the body allows."]);
    expect(result.dims).toEqual({ "chest-width": 500, "body-length": 750, "sleeve-length": 250 });
    expect(result.missing).toEqual([]);
  });

  it("does not change the values it is given", () => {
    const values = new Map([["chest-width", 500]]);
    resolveDimensions({ needed: NEEDED, values, proportions: PROPORTIONS, check: fine });
    expect([...values.entries()]).toEqual([["chest-width", 500]]);
  });
});
