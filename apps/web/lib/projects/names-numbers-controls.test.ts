import { describe, expect, it } from "vitest";
import { applyAction, createSpec, type GarmentSpec } from "@/lib/garment";
import { buildNamesNumbersAction, namesNumbersPanel, removeNamesNumbersAction, type NamesNumbersForm } from "./names-numbers-controls";

function spec(typeId: string): GarmentSpec {
  const made = createSpec(typeId, "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
}

const formFor = (typeId: string): NamesNumbersForm => namesNumbersPanel(spec(typeId))!.form;

describe("the names and numbers form", () => {
  it("starts with the name and number on the back ticked, a sample, and nothing else chosen", () => {
    const panel = namesNumbersPanel(spec("team-jersey"))!;
    expect(panel.set).toBe(false);
    expect(panel.form.places).toEqual([
      { place: "back-name", on: true, heightCm: "" },
      { place: "back-number", on: true, heightCm: "" },
      { place: "front-number", on: false, heightCm: "" },
    ]);
    expect(panel.form).toMatchObject({ style: "", technique: "", colour: "", sampleName: "PLAYER", sampleNumber: "10" });
    expect(panel.placeLabels["back-name"]).toBe("Name across the upper back");
  });

  it("offers a leg number on shorts", () => {
    expect(formFor("shorts").places).toEqual([{ place: "leg-number", on: true, heightCm: "" }]);
  });

  it("makes a change that saves only what was given: an empty height stays unset", () => {
    const form = { ...formFor("team-jersey"), style: "varsity", swatch: "D4A017" };
    const request = buildNamesNumbersAction({ ...form, places: form.places.map((entry) => (entry.place === "back-number" ? { ...entry, heightCm: "25" } : entry)) });
    expect(request.kind).toBe("action");
    if (request.kind !== "action" || request.action.type !== "set-names-numbers") return;
    expect(request.action.namesAndNumbers.places).toEqual([{ place: "back-name" }, { place: "back-number", height: 2500 }]);
    expect(request.action.namesAndNumbers.style).toBe("varsity");
    expect(request.action.namesAndNumbers.swatch).toBe("#d4a017");
    expect(request.action.namesAndNumbers.technique).toBeUndefined();
    const saved = applyAction(spec("team-jersey"), request.action);
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(namesNumbersPanel(saved.spec)?.form.places[1]).toEqual({ place: "back-number", on: true, heightCm: "25" });
  });

  it("refuses no place, a height that is not a length, a bad colour and a bad sample number, with a reason", () => {
    const form = formFor("team-jersey");
    const none = { ...form, places: form.places.map((entry) => ({ ...entry, on: false })) };
    expect(buildNamesNumbersAction(none)).toEqual({ kind: "problem", reason: "Tick at least one place." });
    const tall = { ...form, places: form.places.map((entry) => ({ ...entry, heightCm: "tall" })) };
    expect(buildNamesNumbersAction(tall)).toMatchObject({ kind: "problem" });
    expect(buildNamesNumbersAction({ ...form, swatch: "gold" })).toMatchObject({ kind: "problem" });
    expect(buildNamesNumbersAction({ ...form, sampleNumber: "123" })).toEqual({ kind: "problem", reason: "Enter a sample number from 0 to 99." });
  });

  it("removes them", () => {
    expect(removeNamesNumbersAction()).toEqual({ kind: "action", action: { type: "remove-names-numbers" } });
  });
});
