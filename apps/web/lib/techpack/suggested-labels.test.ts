import { describe, expect, it } from "vitest";
import { describeCell, valueAt } from "./suggested-labels";

const doc = {
  cover: { options: [{ label: "Neckline" }] },
  measurements: {
    columns: [{ size: "M" }, {}],
    groups: [{ rows: [{ label: "Chest width" }] }],
  },
  components: {
    fabrics: [{ panels: [{ label: "Front" }, { label: "Back" }] }, {}],
    others: [{ label: "Rib" }],
  },
  construction: { seams: [{ label: "Side seam" }] },
  colourways: { colourways: [{ name: "Home", rows: [{ label: "Body" }] }] },
  artwork: {
    items: [{ name: { value: "Crest" } }],
    playerMarks: [{ place: { value: "Back number" } }],
  },
  labelling: { rows: [{ label: "Care label" }] },
};

describe("valueAt", () => {
  it("follows dots and indexes down from the root", () => {
    expect(valueAt(doc, "measurements.groups[0].rows[0].label")).toBe("Chest width");
  });

  it("gives undefined when the path runs past a value", () => {
    expect(valueAt(doc, "cover.options[0].label.more")).toBeUndefined();
    expect(valueAt(null, "cover")).toBeUndefined();
  });
});

describe("describeCell", () => {
  it("names a cover option's choice and a known cover field", () => {
    expect(describeCell(doc, "cover.options[0].choice")).toMatchObject({ sectionId: "cover", subject: "Neckline", field: "choice" });
    expect(describeCell(doc, "cover.season")).toMatchObject({ subject: "Season", field: "" });
  });

  it("names an unknown cover field by its path", () => {
    expect(describeCell(doc, "cover.mystery").subject).toBe("cover.mystery");
  });

  it("gives a length its size, and none when the column has no size", () => {
    expect(describeCell(doc, "measurements.groups[0].rows[0].values[0]")).toMatchObject({ subject: "Chest width", field: "value", size: "M" });
    expect(describeCell(doc, "measurements.groups[0].rows[0].values[1]").size).toBeNull();
    expect(describeCell(doc, "measurements.groups[0].rows[0].tolerance").field).toBe("tolerance");
  });

  it("names a fabric by its parts, and copes with a fabric that lists none", () => {
    expect(describeCell(doc, "components.fabrics[0].consumption")).toMatchObject({ field: "consumption" });
    expect(describeCell(doc, "components.fabrics[0].weight").subject).toContain("Front");
    expect(describeCell(doc, "components.fabrics[1].weight").field).toBe("weight");
  });

  it("drops the field for a component's proposal note", () => {
    expect(describeCell(doc, "components.others[0].proposalNote")).toMatchObject({ subject: "Rib", field: "" });
    expect(describeCell(doc, "components.others[0].quantity").field).toBe("quantity");
  });

  it("names seam fields, and keeps an unknown one as it is", () => {
    expect(describeCell(doc, "construction.seams[0].stitchClass").field).toBe("stitch class");
    expect(describeCell(doc, "construction.seams[0].width").field).toBe("width");
  });

  it("names a colourway's code and screen colour", () => {
    expect(describeCell(doc, "colourways.colourways[0].rows[0].code")).toMatchObject({ subject: "Home: Body", field: "colour code" });
    expect(describeCell(doc, "colourways.colourways[0].rows[0].screenColour").field).toBe("screen colour");
  });

  it("names artwork and player mark fields, and keeps unknown ones", () => {
    expect(describeCell(doc, "artwork.items[0].content.text")).toMatchObject({ subject: "Crest", field: "shows" });
    expect(describeCell(doc, "artwork.items[0].opacity").field).toBe("opacity");
    expect(describeCell(doc, "artwork.playerMarks[0].height")).toMatchObject({ subject: "Back number", field: "height" });
    expect(describeCell(doc, "artwork.playerMarks[0].outline").field).toBe("outline");
  });

  it("names a labelling row", () => {
    expect(describeCell(doc, "labelling.rows[0].value")).toMatchObject({ sectionId: "labelling", subject: "Care label" });
  });

  it("names a path it does not know by the path, in its section or on the cover", () => {
    expect(describeCell(doc, "signOff.when")).toMatchObject({ sectionId: "sign-off", subject: "signOff.when" });
    expect(describeCell(doc, "elsewhere[0].x")).toMatchObject({ sectionId: "cover", subject: "elsewhere[0].x" });
  });
});
