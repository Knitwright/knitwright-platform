import { describe, expect, it } from "vitest";
import { applyAction, createSpec, type GarmentSpec } from "@/lib/garment";
import { explainChanges } from "./explain";

function start(typeId: string): GarmentSpec {
  const made = createSpec(typeId, "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
}

function apply(spec: GarmentSpec, ...actions: unknown[]): GarmentSpec {
  return actions.reduce<GarmentSpec>((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, spec);
}

const AI = "ai-suggested" as const;

describe("explaining a change from the difference between two designs", () => {
  it("says nothing when nothing changed", () => {
    const spec = start("crew-tee");
    expect(explainChanges(spec, spec)).toEqual([]);
  });

  it("names an option change with the labels a person reads", () => {
    const before = start("team-jersey");
    const after = apply(before, { type: "set-option", optionId: "sleeve-type", choiceId: "raglan", provenance: AI });
    expect(explainChanges(before, after)).toEqual(["Sleeve type changed from Set in to Raglan."]);
  });

  it("says when only the source of a choice changed", () => {
    const before = start("crew-tee");
    const after = apply(before, { type: "set-option", optionId: "fit", choiceId: "regular", provenance: AI });
    expect(explainChanges(before, after)).toEqual(["Fit stays Regular, now marked Suggested by the assistant."]);
  });

  it("names a change of garment type and wearer, and options gained and lost", () => {
    const before = start("crew-tee");
    const after = apply(before, { type: "change-type", typeId: "polo" }, { type: "change-wearer", wearer: "women" });
    const said = explainChanges(before, after);
    expect(said[0]).toBe("Garment type changed from Crew neck tee to Polo shirt.");
    expect(said).toContain("Wearer changed from Men to Women.");
    expect(said).toContain("Collar changed from No collar to Polo collar.");
    expect(said).toContain("Placket set to Buttons.");
    const back = explainChanges(after, before);
    expect(back).toContain("Placket no longer applies to this garment.");
  });

  it("names measurements set, changed and removed, in centimetres", () => {
    const before = apply(start("crew-tee"), {
      type: "set-measurement",
      pointId: "chest-width",
      value: 5000,
      provenance: "user-edited",
    });
    const changed = apply(before, { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: AI });
    expect(explainChanges(before, changed)).toEqual(["Chest width changed from 50.0 cm to 52.5 cm."]);
    const added = apply(before, { type: "set-measurement", pointId: "body-length", value: 7000, provenance: AI });
    expect(explainChanges(before, added)).toEqual(["Body length set to 70.0 cm."]);
    const removed = apply(before, { type: "remove-measurement", pointId: "chest-width" });
    expect(explainChanges(before, removed)).toEqual(["Chest width measurement removed."]);
    const marked = apply(before, { type: "set-measurement", pointId: "chest-width", value: 5000, provenance: AI });
    expect(explainChanges(before, marked)).toEqual(["Chest width stays 50.0 cm, now marked Suggested by the assistant."]);
  });

  it("names panel colours set, changed and removed", () => {
    const before = start("crew-tee");
    const colourway = (colours: object[]) => ({
      type: "update-colourway",
      colourway: { id: "main", name: "Main colourway", colours },
    });
    const navy = apply(before, colourway([{ panelId: "body-front", colour: "navy", provenance: AI }]));
    expect(explainChanges(before, navy)).toEqual(["Body front in Main colourway set to navy."]);
    const red = apply(navy, colourway([{ panelId: "body-front", colour: "", swatch: "#ff0000", provenance: AI }]));
    expect(explainChanges(navy, red)).toEqual(["Body front in Main colourway changed from navy to #ff0000."]);
    expect(explainChanges(navy, before)).toEqual(["Body front in Main colourway no longer has a colour."]);
  });

  it("names fabric fields and labelling", () => {
    const before = start("crew-tee");
    const after = apply(
      before,
      { type: "change-fabric", id: "main", changes: { composition: "100% cotton", weightGsm: 180 }, provenance: AI },
      { type: "set-labelling", field: "origin", text: "Portugal", provenance: AI },
    );
    expect(explainChanges(before, after)).toEqual([
      "Main fabric: composition set to 100% cotton.",
      "Main fabric: weight set to 180 gsm.",
      "Country of origin set to Portugal.",
    ]);
    const cleared = apply(after, { type: "set-labelling", field: "origin", text: "", provenance: AI });
    expect(explainChanges(after, cleared)).toEqual(["Country of origin removed."]);
    const renamed = apply(after, {
      type: "change-fabric",
      id: "main",
      changes: { composition: "cotton", stretch: "two-way" },
      provenance: AI,
    });
    expect(explainChanges(after, renamed)).toEqual([
      "Main fabric: composition changed from 100% cotton to cotton.",
      "Main fabric: stretch changed from not set to two-way.",
    ]);
  });

  it("still says something for a part it has no words for", () => {
    const before = start("crew-tee");
    const after = apply(before, {
      type: "add-colourway",
      colourway: { id: "second", name: "Second", colours: [] },
    });
    expect(explainChanges(before, after)).toEqual(["Colourway Second added."]);
    const sized: GarmentSpec = { ...before, components: [{ id: "x" }] as unknown as GarmentSpec["components"] };
    expect(explainChanges(before, sized)).toEqual(["Components changed."]);
  });
});
