import { describe, expect, it } from "vitest";
import type { LoadedIllustrations } from "@/lib/images/illustrations";
import { ILLUSTRATION_LABEL } from "@/lib/images/panel-state";
import { illustrationSheetRows, illustrationsForExport } from "./illustrations";

const SRC = "data:image/jpeg;base64,AAAA";

const loaded = (version: number): LoadedIllustrations => ({
  version,
  illustrations: [
    { view: "front", label: "Front", src: SRC, alt: "AI illustration of the front of the garment. Not a specification." },
    { view: "back", label: "Back", src: SRC, alt: "AI illustration of the back of the garment. Not a specification." },
  ],
});

describe("illustrationsForExport", () => {
  it("has nothing to add when no illustrations were made", () => {
    expect(illustrationsForExport(null, 3)).toBeNull();
  });

  it("labels every picture as an illustration, not a specification", () => {
    const made = illustrationsForExport(loaded(3), 3);
    expect(made?.label).toBe(ILLUSTRATION_LABEL);
    expect(made?.note).toBeNull();
    expect(made?.items.map((item) => item.caption)).toEqual([
      "Front. Illustration, not a specification.",
      "Back. Illustration, not a specification.",
    ]);
    expect(made?.items.every((item) => item.src === SRC)).toBe(true);
  });

  it("says when the pictures were made from an older version than the file", () => {
    expect(illustrationsForExport(loaded(2), 3)?.note).toBe("Made from version 2. The design has changed since.");
  });

  it("leaves out pictures made from a later version than the one exported", () => {
    expect(illustrationsForExport(loaded(4), 3)).toBeNull();
  });
});

describe("illustrationSheetRows", () => {
  it("says in words that the pictures are in the PDF, with the same label", () => {
    const made = illustrationsForExport(loaded(2), 3);
    if (!made) throw new Error("expected illustrations");
    expect(illustrationSheetRows(made)).toEqual([
      ILLUSTRATION_LABEL,
      "Made from version 2. The design has changed since.",
      "The pictures (front, back) are in the PDF of this tech pack.",
    ]);
  });
});
