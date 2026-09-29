import { describe, expect, it } from "vitest";
import { applyAction, seamsFor, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { buildConstruction } from "./construction";
import { PROPOSAL_WORDS } from "./text";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const seam = (spec: GarmentSpec, id: string) => {
  const found = buildConstruction(spec).seams.find((entry) => entry.seamId === id);
  if (!found) throw new Error(`No seam ${id}`);
  return found;
};

describe("the construction section", () => {
  it("has a line for each seam of the garment, in registry order", () => {
    const spec = start("polo");
    expect(buildConstruction(spec).seams.map((entry) => entry.seamId)).toEqual(seamsFor(spec).map((entry) => entry.id));
    expect(buildConstruction(spec).id).toBe("construction");
  });

  it("names the panels each seam joins", () => {
    expect(seam(start("crew-tee"), "shoulder-seam").panels.map((panel) => panel.label)).toEqual(["Body front", "Body back"]);
  });

  it("proposes the seam class and stitch class from the registry, and says the source is the registry rule", () => {
    const shoulder = seam(start("crew-tee"), "shoulder-seam");
    expect(shoulder.seamClass).toMatchObject({
      status: "set",
      value: "Superimposed seam",
      iso: "1",
      provenance: "derived",
      proposal: true,
    });
    expect(shoulder.stitchClass).toMatchObject({
      status: "set",
      value: "Four thread overedge",
      iso: "514",
      provenance: "derived",
      proposal: true,
    });
    expect(shoulder.stitchClass.explanation.endsWith(".")).toBe(true);
    expect(shoulder.seamClass.explanation.endsWith(".")).toBe(true);
  });

  it("shows the stitch density as to be confirmed until the user enters one", () => {
    expect(seam(start("crew-tee"), "body-hem").stitchDensity).toEqual({ status: "to-be-confirmed" });
  });

  it("says the classes are a starting proposal for a factory to confirm", () => {
    expect(buildConstruction(start("crew-tee")).note).toBe(
      "The seam classes and stitch classes are a starting proposal from general knitwear practice. Ask your factory to confirm them.",
    );
  });

  it("uses what the user entered, with the user as the source", () => {
    const spec = apply(start("crew-tee"), {
      type: "set-construction",
      entry: {
        seamId: "body-hem",
        seamClass: "bound",
        stitchClass: "three-needle-cover-stitch",
        stitchDensity: "Dense",
        provenance: "user-edited",
      },
    });
    const hem = seam(spec, "body-hem");
    expect(hem.seamClass).toMatchObject({ value: "Bound seam", iso: "3", provenance: "user-edited", proposal: false });
    expect(hem.stitchClass).toMatchObject({ value: "Three needle cover stitch", iso: "605", provenance: "user-edited", proposal: false });
    expect(hem.stitchDensity).toEqual({ status: "set", value: "Dense", provenance: "user-edited" });
  });

  it("keeps the registry proposal for a class the user left alone, when they entered only a density", () => {
    const spec = apply(start("crew-tee"), {
      type: "set-construction",
      entry: { seamId: "body-hem", stitchDensity: "Dense", provenance: "user-edited" },
    });
    const hem = seam(spec, "body-hem");
    expect(hem.seamClass).toMatchObject({ iso: "6", provenance: "derived" });
    expect(hem.stitchClass).toMatchObject({ iso: "406", provenance: "derived", proposal: true });
    expect(hem.stitchDensity).toMatchObject({ provenance: "user-edited" });
  });

  it("keeps the registry proposal when a stored override names a class that is gone", () => {
    const spec = start("crew-tee");
    const stale = {
      ...spec,
      construction: [{ seamId: "body-hem", seamClass: "gone", stitchDensity: "", provenance: "user-edited" as const }],
    };
    expect(seam(stale, "body-hem").seamClass).toMatchObject({ iso: "6", provenance: "derived" });
  });

  it("gives the stitch density the source of the entry, and to be confirmed when it is empty", () => {
    const spec = apply(start("crew-tee"), {
      type: "set-construction",
      entry: { seamId: "body-hem", stitchDensity: "Dense", provenance: "read-from-image" },
    });
    expect(seam(spec, "body-hem").stitchDensity).toEqual({ status: "set", value: "Dense", provenance: "read-from-image" });
    const empty = apply(start("crew-tee"), {
      type: "set-construction",
      entry: { seamId: "body-hem", seamClass: "bound", stitchDensity: "", provenance: "user-edited" },
    });
    expect(seam(empty, "body-hem").stitchDensity).toEqual({ status: "to-be-confirmed" });
  });

  it("puts the words that say it is only a proposal on every row that holds one", () => {
    for (const seam of buildConstruction(start("crew-tee")).seams) {
      expect(seam.caveat).toBe(PROPOSAL_WORDS);
      expect(seam.seamClass.proposal && seam.stitchClass.proposal).toBe(true);
    }
    expect(PROPOSAL_WORDS).toBe("Proposed by Knitwright. Not confirmed by anyone.");
  });

  it("keeps the words on a row while one of its two classes is still a proposal, and drops them when both were chosen", () => {
    const one = apply(start("crew-tee"), {
      type: "set-construction",
      entry: { seamId: "body-hem", seamClass: "bound", stitchDensity: "", provenance: "user-edited" },
    });
    expect(seam(one, "body-hem").caveat).toBe(PROPOSAL_WORDS);
    const both = apply(start("crew-tee"), {
      type: "set-construction",
      entry: { seamId: "body-hem", seamClass: "bound", stitchClass: "lockstitch", stitchDensity: "", provenance: "user-edited" },
    });
    expect(seam(both, "body-hem").caveat).toBeNull();
    expect(seam(both, "body-hem").seamClass.proposal).toBe(false);
  });

  it("does not call a class a proposal when the user chose the same class the registry proposes", () => {
    const spec = apply(start("crew-tee"), {
      type: "set-construction",
      entry: { seamId: "body-hem", seamClass: "edge-finishing", stitchClass: "two-needle-bottom-cover-stitch", stitchDensity: "", provenance: "user-edited" },
    });
    expect(seam(spec, "body-hem").seamClass).toMatchObject({ provenance: "user-edited", proposal: false });
  });

  it("gives no seams for an unknown type, and says so", () => {
    const section = buildConstruction({ ...start("crew-tee"), typeId: "kilt" });
    expect(section.seams).toEqual([]);
    expect(section.note).toBe("This garment type has no seams listed yet.");
  });
});
