import { describe, expect, it } from "vitest";
import { fileMenu, sameForm, simulateChip, simulationState } from "./index";

const form = { options: { collar: "C01" }, parameters: { body_length_offset: 0 } };

describe("sameForm", () => {
  it("is true for the same options and lengths", () => {
    expect(sameForm(form, { options: { collar: "C01" }, parameters: { body_length_offset: 0 } })).toBe(true);
  });

  it("is false when an option, a length or the number of them differs", () => {
    expect(sameForm(form, { ...form, options: { collar: "C02" } })).toBe(false);
    expect(sameForm(form, { ...form, parameters: { body_length_offset: 20 } })).toBe(false);
    expect(sameForm(form, { ...form, parameters: {} })).toBe(false);
    expect(sameForm(form, { options: {}, parameters: form.parameters })).toBe(false);
  });
});

describe("the Simulate chip", () => {
  it("says nothing is sim ready while there is no model", () => {
    expect(simulateChip(simulationState(form, null, false))).toEqual({ label: "Not sim ready", state: "none", canSimulate: false });
  });

  it("says Simulated while the model matches the form", () => {
    expect(simulateChip(simulationState(form, form, true))).toEqual({ label: "Simulated", state: "ready", canSimulate: false });
  });

  it("stops saying Simulated once the form has moved on, and offers the button", () => {
    const chip = simulateChip(simulationState({ ...form, parameters: { body_length_offset: 20 } }, form, true));

    expect(chip).toEqual({ label: "Not sim ready", state: "stale", canSimulate: true });
  });

  it("is stale when a model is shown but nothing says what it was built from", () => {
    expect(simulationState(form, null, true)).toBe("stale");
  });
});

describe("the File menu", () => {
  it("lists only places that already exist, each with a real address", () => {
    const items = fileMenu("abc 1");

    expect(items.map((item) => item.label)).toEqual(["Design details", "Version history", "Share…", "Factory file", "Make and order", "Move to trash…"]);
    for (const item of items) expect(item.href).toContain("abc%201");
    expect(items.filter((item) => item.kind === "tool").map((item) => item.href)).toEqual([
      "/studio/abc%201?tool=garment",
      "/studio/abc%201?tool=history",
      "/studio/abc%201?tool=share",
    ]);
    expect(items.filter((item) => item.kind === "page").map((item) => item.href)).toEqual(["/studio/abc%201/tech-pack", "/studio/abc%201/make", "/studio/abc%201/delete"]);
  });
});
