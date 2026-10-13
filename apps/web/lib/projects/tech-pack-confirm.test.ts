import { describe, expect, it } from "vitest";
import { applyAction, createSpec, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { CHARTS, packFor } from "@/lib/techpack/fixtures/designs";
import { allCells } from "@/lib/techpack";
import { sourceWords } from "@/lib/techpack/exports/contents";
import { exportSections } from "@/lib/techpack/exports/tables";
import { confirmActions, confirmAllActions, confirmables } from "./tech-pack-confirm";

const AI = "ai-suggested" as const;

const apply = (spec: GarmentSpec, actions: readonly unknown[]): GarmentSpec =>
  actions.reduce<GarmentSpec>((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, spec);

const menTee = (): GarmentSpec => {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
};

/** A team jersey where the assistant suggested something in every kind of place. */
const suggestedJersey = (): GarmentSpec =>
  apply(start("team-jersey", "men"), [
    { type: "set-option", optionId: "fit", choiceId: "slim", provenance: AI },
    { type: "change-fabric", id: "main", changes: { name: "Mesh", composition: "Polyester" }, provenance: AI },
    { type: "update-colourway", colourway: { id: "main", name: "Home", colours: [{ panelId: "body-front", colour: "Navy", provenance: AI }] } },
    { type: "set-component", component: { id: "main-thread", name: "Polyester thread", details: "", quantity: "", provenance: AI } },
    { type: "set-construction", entry: { seamId: "body-hem", stitchDensity: "12 per 3 cm", provenance: AI } },
    { type: "set-labelling", field: "care", text: "Wash at 30", provenance: AI },
    {
      type: "add-artwork",
      artwork: {
        id: "crest",
        name: "Crest",
        source: { kind: "text", text: "FC" },
        panelId: "body-front",
        anchor: "left-chest",
        offsetX: 0,
        offsetY: 0,
        width: 800,
        height: 400,
        technique: "embroidery",
        provenance: AI,
      },
    },
    {
      type: "set-names-numbers",
      namesAndNumbers: { places: [{ place: "back-number" }], colour: "", sampleName: "PLAYER", sampleNumber: "10", provenance: AI },
    },
  ]);

/** Every cell of the pack that is still a suggestion or a proposal. */
const unconfirmed = (spec: GarmentSpec, charts = CHARTS) => {
  const pack = packFor(spec, { charts });
  return pack.suggested.items.length + pack.suggested.proposals.length;
};

const confirmEverything = (spec: GarmentSpec, charts = CHARTS): GarmentSpec => {
  const targets = confirmables(spec, packFor(spec, { charts })).map((entry) => entry.target);
  return apply(spec, confirmAllActions(spec, targets));
};

describe("confirmables", () => {
  it("lists a seam class and a stitch class for each seam of a new design, as proposals", () => {
    const spec = start("crew-tee");
    const found = confirmables(spec, packFor(spec));
    const construction = found.filter((entry) => entry.sectionId === "construction");
    expect(construction.length).toBeGreaterThan(0);
    expect(construction.every((entry) => entry.source === "Proposed by Knitwright. Not confirmed by anyone.")).toBe(true);
    expect(construction[0]?.label).toMatch(/^Shoulder seam: seam class .+, ISO \d+$/);
    expect(new Set(found.map((entry) => entry.key)).size).toBe(found.length);
  });

  it("lists the sizes and each measurement row a size chart suggested", () => {
    const spec = menTee();
    const found = confirmables(spec, packFor(spec, { charts: CHARTS }));
    const sizes = found.find((entry) => entry.target.kind === "sizes");
    expect(sizes).toMatchObject({ sectionId: "cover", source: "Suggested from a size chart" });
    const chest = found.find((entry) => entry.key === "confirm:measurements:chest-width");
    expect(chest?.label).toMatch(/^Chest width: sizes .+ and tolerance ±.+ cm$/);
  });

  it("lists every kind of thing the assistant suggested", () => {
    const spec = suggestedJersey();
    const kinds = new Set(confirmables(spec, packFor(spec)).map((entry) => entry.target.kind));
    for (const kind of ["option", "fabric", "colourway", "component", "construction", "labelling", "artwork", "names-numbers"]) {
      expect(kinds.has(kind as never), kind).toBe(true);
    }
  });

  it("lists nothing for a garment type that does not exist", () => {
    const spec = start("crew-tee");
    expect(confirmables({ ...spec, typeId: "no-such-type" }, packFor(spec))).toEqual([]);
  });
});

describe("confirming", () => {
  it("leaves nothing suggested or proposed once everything a chart suggested is confirmed", () => {
    const spec = menTee();
    expect(unconfirmed(spec)).toBeGreaterThan(0);
    const confirmed = confirmEverything(spec);
    expect(unconfirmed(confirmed)).toBe(0);
    expect(confirmed.sizing).not.toBeNull();
  });

  it("leaves nothing suggested once everything the assistant suggested is confirmed, and makes each value the person's own", () => {
    const confirmed = confirmEverything(suggestedJersey(), { runs: [], charts: [] });
    expect(unconfirmed(confirmed, { runs: [], charts: [] })).toBe(0);
    const sources = allCells(packFor(confirmed)).flatMap(({ cell }) => (cell.status === "set" ? [cell.provenance] : []));
    expect(sources).not.toContain(AI);
    expect(confirmed.options.fit).toEqual({ choiceId: "slim", provenance: "user-edited" });
    expect(confirmed.fabrics[0]).toMatchObject({ name: "Mesh", composition: "Polyester", provenance: "user-edited" });
  });

  it("confirms a proposed part as used, with its details still to be confirmed", () => {
    const spec = start("crew-tee");
    const part = confirmables(spec, packFor(spec)).find((entry) => entry.target.kind === "component");
    if (!part) throw new Error("Expected a proposed part.");
    const confirmed = apply(spec, confirmActions(spec, part.target));
    const line = packFor(confirmed).components.others.find((entry) => entry.slotId === (part.target as { slotId: string }).slotId);
    expect(line?.proposalNote).toBeNull();
    expect(line?.name.status).toBe("to-be-confirmed");
  });

  it("keeps the stitch density and the other class of a seam when one class is confirmed", () => {
    const spec = apply(start("crew-tee"), [
      { type: "set-construction", entry: { seamId: "body-hem", stitchDensity: "12 per 3 cm", provenance: "user-edited" } },
    ]);
    const seam = confirmables(spec, packFor(spec)).find((entry) => entry.key === "confirm:construction:body-hem:seam");
    if (!seam) throw new Error("Expected the hem's seam class.");
    const confirmed = apply(spec, confirmActions(spec, seam.target));
    const entry = confirmed.construction.find((candidate) => candidate.seamId === "body-hem");
    expect(entry).toMatchObject({ stitchDensity: "12 per 3 cm", provenance: "user-edited" });
    expect(entry?.seamClass).toBeDefined();
    expect(entry?.stitchClass).toBeUndefined();
  });

  it("confirms both classes of one seam together without one undoing the other", () => {
    const spec = start("crew-tee");
    const hem = confirmables(spec, packFor(spec)).filter((entry) => entry.key.startsWith("confirm:construction:body-hem"));
    const confirmed = apply(spec, confirmAllActions(spec, hem.map((entry) => entry.target)));
    const entry = confirmed.construction.find((candidate) => candidate.seamId === "body-hem");
    expect(entry?.seamClass).toBeDefined();
    expect(entry?.stitchClass).toBeDefined();
  });

  it("does nothing when the thing is the person's own already, or is gone", () => {
    const spec = confirmEverything(suggestedJersey(), { runs: [], charts: [] });
    const targets = confirmables(suggestedJersey(), packFor(suggestedJersey())).map((entry) => entry.target);
    const again: SpecAction[] = targets.flatMap((target) => [...confirmActions(spec, target)]);
    expect(again.filter((action) => action.type !== "set-measurement" && action.type !== "set-tolerance")).toEqual([]);
    expect(confirmActions(spec, { kind: "fabric", fabricId: "gone" })).toEqual([]);
    expect(confirmActions(spec, { kind: "colourway", colourwayId: "gone" })).toEqual([]);
    expect(confirmActions(spec, { kind: "component", slotId: "gone" })).toEqual([]);
    expect(confirmActions(spec, { kind: "option", optionId: "fit", choiceId: "relaxed" })).toEqual([]);
    expect(confirmActions({ ...spec, sizing: { sizes: ["M"], baseSize: "M" } }, { kind: "sizes", sizes: ["S"], baseSize: "S" })).toEqual([]);
  });

  it("changes the exports only in where each confirmed value came from: the same tables, the same values, now the person's own", () => {
    const spec = menTee();
    const before = exportSections(packFor(spec, { charts: CHARTS }));
    const after = exportSections(packFor(confirmEverything(spec), { charts: CHARTS }));
    // The list of suggestions empties, as it should. Every other table keeps its shape.
    const shape = (sections: typeof before) =>
      sections.filter((section) => section.id !== "suggested").map((section) => section.tables.map((table) => [table.columns.length, table.rows.length]));
    expect(shape(after)).toEqual(shape(before));
    const values = (sections: typeof before) =>
      sections
        .filter((section) => section.id !== "cover" && section.id !== "suggested")
        .flatMap((section) => section.tables.flatMap((table) => table.rows.flatMap((row) => row.map((datum) => ("cell" in datum && datum.cell?.status === "set" ? datum.cell.value : null)))));
    // A proposed part's note goes once the part is confirmed as used. Every other value stays.
    const notNote = (value: string | null) => (value === "Proposed by Knitwright. Not confirmed by anyone." ? null : value);
    expect(values(after).map(notNote)).toEqual(values(before).map(notNote));
    const words = after.flatMap((section) =>
      section.tables.flatMap((table) => table.rows.flatMap((row) => row.flatMap((datum) => ("cell" in datum && datum.cell ? [sourceWords(datum.cell)] : [])))),
    );
    expect(words).not.toContain("Suggested from a size chart");
    expect(words).not.toContain("Proposed by Knitwright. Not confirmed by anyone.");
    expect(words).toContain("Typed in by you");
  });

  it("leaves out a confirmation the rules refuse", () => {
    const spec = start("crew-tee");
    expect(confirmAllActions(spec, [{ kind: "measurement", pointId: "no-such-point", values: [{ size: null, tenthsMm: 5000 }], tolerance: null }])).toEqual([]);
  });
});
