import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import {
  SEAM_CLASS_CHOICES,
  STITCH_CLASS_CHOICES,
  STRETCH_CHOICES,
  componentAction,
  componentRows,
  constructionAction,
  fabricAction,
  fabricRows,
  labellingAction,
  labellingRows,
  panelFabricRows,
  seamRows,
} from "./tech-pack-forms";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

const values = (patch: object = {}) => ({
  name: "Interlock",
  composition: "Cotton",
  construction: "",
  weight: "180",
  finish: "",
  consumption: "",
  stretch: "two-way",
  ...patch,
});

describe("fabricRows", () => {
  it("starts with the one fabric of a new design, with every detail empty", () => {
    const [row] = fabricRows(start("crew-tee"));
    expect(row).toMatchObject({
      id: "main",
      canRemove: false,
      values: { name: "Main fabric", composition: "", construction: "", weight: "", finish: "", consumption: "", stretch: "not-set" },
      usedBy: ["Body front", "Body back", "Left sleeve", "Right sleeve", "Neckband"],
    });
  });

  it("writes the weight as a number of grams and lets a second fabric be removed", () => {
    const spec = apply(start("crew-tee"), {
      type: "add-fabric",
      fabric: { id: "mesh", name: "Mesh", composition: "", construction: "", weightGsm: 120, finish: "", consumption: "", stretch: "none", provenance: "user-edited" },
    });
    const rows = fabricRows(spec);
    expect(rows.map((row) => row.canRemove)).toEqual([true, true]);
    expect(rows[1]?.values.weight).toBe("120");
    expect(rows[1]?.usedBy).toEqual([]);
  });
});

describe("panelFabricRows", () => {
  it("has a row for each panel, showing the fabric it uses now and the fabrics it could use", () => {
    const rows = panelFabricRows(start("crew-tee"));
    expect(rows.map((row) => row.label)).toEqual(["Body front", "Body back", "Left sleeve", "Right sleeve", "Neckband"]);
    expect(rows[0]).toEqual({ panelId: "body-front", label: "Body front", fabricId: "main", choices: [{ id: "main", label: "Main fabric" }] });
  });

  it("shows the fabric a panel was given", () => {
    const withMesh = apply(start("crew-tee"), {
      type: "add-fabric",
      fabric: { id: "mesh", name: "Mesh", composition: "", construction: "", weightGsm: null, finish: "", consumption: "", stretch: "not-set", provenance: "user-edited" },
    });
    const spec = apply(withMesh, { type: "assign-fabric", panelId: "body-back", fabricId: "mesh" });
    expect(panelFabricRows(spec).map((row) => row.fabricId)).toEqual(["main", "mesh", "main", "main", "main"]);
  });
});

describe("fabricAction", () => {
  it("builds an update for a fabric that exists, with the weight as a whole number", () => {
    const result = fabricAction("main", values(), false);
    expect(result).toEqual({
      ok: true,
      action: {
        type: "update-fabric",
        fabric: {
          id: "main",
          name: "Interlock",
          composition: "Cotton",
          construction: "",
          weightGsm: 180,
          finish: "",
          consumption: "",
          stretch: "two-way",
          provenance: "user-edited",
        },
      },
    });
  });

  it("builds an add for a new fabric", () => {
    const result = fabricAction("new-id", values(), true);
    expect(result.ok && result.action.type).toBe("add-fabric");
  });

  it("leaves the weight empty rather than zero when nothing is typed", () => {
    const result = fabricAction("main", values({ weight: "  " }), false);
    expect(result.ok && result.action.type === "update-fabric" && result.action.fabric.weightGsm).toBe(null);
  });

  it("accepts a weight with the unit written after it", () => {
    const result = fabricAction("main", values({ weight: "180 gsm" }), false);
    expect(result.ok && result.action.type === "update-fabric" && result.action.fabric.weightGsm).toBe(180);
  });

  it("refuses a weight that is not a whole number of grams, beside the weight field", () => {
    for (const weight of ["heavy", "18.5", "-3", "0", "2001"]) {
      const result = fabricAction("main", values({ weight }), false);
      expect(result.ok).toBe(false);
      expect(!result.ok && Object.keys(result.errors)).toEqual(["weight"]);
    }
    const bad = fabricAction("main", values({ weight: "heavy" }), false);
    expect(!bad.ok && bad.errors.weight).toBe("Enter the weight as a whole number of grams per square metre, such as 180.");
  });

  it("refuses a fabric with no name, beside the name field", () => {
    const result = fabricAction("main", values({ name: " " }), false);
    expect(!result.ok && result.errors).toEqual({ name: "Give the fabric a name." });
  });

  it("refuses text that is too long or has a line break, beside its field", () => {
    const long = fabricAction("main", values({ composition: "x".repeat(300) }), false);
    expect(!long.ok && long.errors.composition).toBe("Use 200 characters or fewer.");
    const broken = fabricAction("main", values({ finish: "a\nb" }), false);
    expect(!broken.ok && broken.errors.finish).toBe("Remove line breaks and hidden characters.");
  });

  it("refuses a stretch it does not know", () => {
    const result = fabricAction("main", values({ stretch: "very" }), false);
    expect(result.ok).toBe(false);
  });

  it("offers every stretch choice in plain words", () => {
    expect(STRETCH_CHOICES.map((choice) => choice.label)).toEqual(["Not set", "No stretch", "Two-way stretch", "Four-way stretch"]);
  });
});

describe("componentRows and componentAction", () => {
  it("has a row for each thing the design implies, with the details empty", () => {
    const rows = componentRows(start("polo"));
    expect(rows.map((row) => row.slotId)).toContain("buttons");
    expect(rows[0]).toMatchObject({ slotId: "main-thread", label: "Main thread", values: { name: "", details: "", quantity: "" }, hasEntry: false });
  });

  it("shows what the user wrote", () => {
    const spec = apply(start("polo"), {
      type: "set-component",
      component: { id: "buttons", name: "Shell", details: "4 hole", quantity: "4 per garment", provenance: "user-edited" },
    });
    const row = componentRows(spec).find((entry) => entry.slotId === "buttons");
    expect(row).toMatchObject({ values: { name: "Shell", details: "4 hole", quantity: "4 per garment" }, hasEntry: true });
  });

  it("builds a set-component action with the quantity as the free text typed", () => {
    expect(componentAction("buttons", { name: "Shell", details: "", quantity: "4 per garment" }, false)).toEqual({
      ok: true,
      action: {
        type: "set-component",
        component: { id: "buttons", name: "Shell", details: "", quantity: "4 per garment", provenance: "user-edited" },
      },
    });
  });

  it("removes the entry when every field is emptied, and does nothing when there was none", () => {
    const empty = { name: "", details: "", quantity: "" };
    expect(componentAction("buttons", empty, true)).toEqual({ ok: true, action: { type: "remove-component", id: "buttons" } });
    expect(componentAction("buttons", empty, false)).toEqual({ ok: true, action: null });
  });

  it("refuses text that is too long, beside its field", () => {
    const result = componentAction("buttons", { name: "x".repeat(100), details: "", quantity: "" }, false);
    expect(!result.ok && result.errors.name).toBe("Use 60 characters or fewer.");
  });
});

describe("seamRows and constructionAction", () => {
  it("has a row for each seam, showing the proposal from the registry", () => {
    const [row] = seamRows(start("crew-tee"));
    expect(row).toMatchObject({
      seamId: "shoulder-seam",
      label: "Shoulder seam",
      panels: "Body front and Body back",
      proposal: { seamClass: "Superimposed seam", stitchClass: "Four thread overedge" },
      values: { seamClass: "", stitchClass: "", stitchDensity: "" },
      hasEntry: false,
    });
  });

  it("shows an override and a density the user entered", () => {
    const spec = apply(start("crew-tee"), {
      type: "set-construction",
      entry: { seamId: "body-hem", seamClass: "bound", stitchDensity: "Dense", provenance: "user-edited" },
    });
    const row = seamRows(spec).find((entry) => entry.seamId === "body-hem");
    expect(row).toMatchObject({ values: { seamClass: "bound", stitchClass: "", stitchDensity: "Dense" }, hasEntry: true });
  });

  it("offers the ISO classes with their numbers and names", () => {
    expect(STITCH_CLASS_CHOICES.map((choice) => choice.label)).toContain("Four thread overedge, ISO 514");
    expect(SEAM_CLASS_CHOICES.map((choice) => choice.label)).toContain("Superimposed seam, ISO 1");
  });

  it("builds a set-construction action with only what was chosen", () => {
    expect(constructionAction("body-hem", { seamClass: "", stitchClass: "lockstitch", stitchDensity: "Dense" }, false)).toEqual({
      ok: true,
      action: {
        type: "set-construction",
        entry: { seamId: "body-hem", stitchClass: "lockstitch", stitchDensity: "Dense", provenance: "user-edited" },
      },
    });
  });

  it("removes the entry when the classes go back to the proposal and the density is emptied", () => {
    const back = { seamClass: "", stitchClass: "", stitchDensity: "" };
    expect(constructionAction("body-hem", back, true)).toEqual({ ok: true, action: { type: "remove-construction", seamId: "body-hem" } });
    expect(constructionAction("body-hem", back, false)).toEqual({ ok: true, action: null });
  });

  it("refuses a class that is not on the list, and a density that is too long", () => {
    const bad = constructionAction("body-hem", { seamClass: "glued", stitchClass: "", stitchDensity: "" }, false);
    expect(!bad.ok && bad.errors.seamClass).toBe("Choose a seam class from the list.");
    const other = constructionAction("body-hem", { seamClass: "", stitchClass: "glued", stitchDensity: "" }, false);
    expect(!other.ok && other.errors.stitchClass).toBe("Choose a stitch class from the list.");
    const long = constructionAction("body-hem", { seamClass: "", stitchClass: "", stitchDensity: "x".repeat(100) }, false);
    expect(!long.ok && long.errors.stitchDensity).toBe("Use 60 characters or fewer.");
  });
});

describe("labellingRows and labellingAction", () => {
  it("has the five fields, empty in a new design", () => {
    const rows = labellingRows(start("crew-tee"));
    expect(rows.map((row) => [row.field, row.label, row.text])).toEqual([
      ["care", "Care instructions", ""],
      ["composition", "Composition label", ""],
      ["origin", "Country of origin", ""],
      ["fold", "How to fold", ""],
      ["bag", "How to bag", ""],
    ]);
  });

  it("shows what was written", () => {
    const spec = apply(start("crew-tee"), { type: "set-labelling", field: "origin", text: "Portugal", provenance: "user-edited" });
    expect(labellingRows(spec)[2]?.text).toBe("Portugal");
  });

  it("builds a set-labelling action", () => {
    expect(labellingAction("care", "Wash cold", false)).toEqual({
      ok: true,
      action: { type: "set-labelling", field: "care", text: "Wash cold", provenance: "user-edited" },
    });
  });

  it("clears a field that was set when the text is emptied, and does nothing when it was not set", () => {
    expect(labellingAction("care", "  ", true)).toEqual({
      ok: true,
      action: { type: "set-labelling", field: "care", text: "", provenance: "user-edited" },
    });
    expect(labellingAction("care", "", false)).toEqual({ ok: true, action: null });
  });

  it("refuses text that is too long or has a line break", () => {
    const long = labellingAction("care", "x".repeat(300), false);
    expect(!long.ok && long.errors.text).toBe("Use 200 characters or fewer.");
    const broken = labellingAction("care", "a\nb", false);
    expect(!broken.ok && broken.errors.text).toBe("Remove line breaks and hidden characters.");
  });
});
