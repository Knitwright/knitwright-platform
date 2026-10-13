import { describe, expect, it } from "vitest";
import type { GarmentSpec, KitPattern } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { exportSections } from "./exports/tables";
import { packFor } from "./fixtures/designs";
import { buildSuggested } from "./suggested";

const hoops: KitPattern = {
  style: "hoops",
  colours: [{ colour: "Gold 123C", swatch: "#d4af37" }, { colour: "White" }],
  size: 900,
  technique: "sublimation",
  provenance: "user-edited",
};

const withPattern = (spec: GarmentSpec, kitPattern: KitPattern): GarmentSpec => ({ ...spec, kitPattern });

describe("a kit pattern in the tech pack", () => {
  it("is a line of the artwork, describing the print with its colours", () => {
    const { artwork } = packFor(withPattern(start("team-jersey"), hoops));
    expect(artwork.note).toBeNull();
    const [line] = artwork.items;
    expect(line?.id).toBe("kit-pattern");
    expect(line?.name).toMatchObject({ value: "Kit pattern: Hoops" });
    expect(line?.panel).toMatchObject({ value: "Body front and Body back" });
    expect(line?.anchor).toMatchObject({ value: "Whole panel" });
    expect(line?.width).toMatchObject({ status: "set", tenthsMm: 900 });
    expect(line?.height).toEqual({ status: "to-be-confirmed" });
    expect(line?.technique).toMatchObject({ value: "Sublimation" });
    expect(line?.content).toMatchObject({
      kind: "text",
      text: { value: "Hoops in Gold 123C (#d4af37) and White over the body colour, bands 9.0 cm, on the front and back of the body." },
    });
  });

  it("leaves the size and how it is made to be confirmed when nobody gave them", () => {
    const { artwork } = packFor(withPattern(start("polo"), { ...hoops, size: undefined, technique: undefined }));
    const [line] = artwork.items;
    expect(line?.width).toEqual({ status: "to-be-confirmed" });
    expect(line?.technique).toEqual({ status: "to-be-confirmed" });
  });

  it("is written into the exports", () => {
    const sections = exportSections(packFor(withPattern(start("team-jersey"), hoops)));
    const artwork = sections.find((section) => section.id === "artwork");
    expect(JSON.stringify(artwork)).toContain("Kit pattern: Hoops");
  });

  it("is listed as a suggestion when the assistant set it", () => {
    const pack = packFor(withPattern(start("team-jersey"), { ...hoops, provenance: "ai-suggested" }));
    expect(buildSuggested(pack).items.some((item) => item.sectionId === "artwork")).toBe(true);
  });
});
