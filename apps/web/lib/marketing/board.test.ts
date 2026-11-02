import { describe, expect, it } from "vitest";
import { EMPTY_SETTINGS, asSettings, cleared, marketingSettings, withColours, withExport, withFill, withPicture, withTemplate, withWords } from "./board";
import { buildLayouts } from "./templates/plans";

const layout = () => buildLayouts().find((one) => one.key === "new-kit-reveal")!;
const headline = () => layout().slots.find((one) => one.id === "headline")!;
const mockup = () => layout().slots.find((one) => one.id === "mockup")!;

const picture = { fileId: "file-1", contentType: "image/png", provenance: "deterministic" } as const;

describe("reading a board's settings", () => {
  it("reads nothing at all as nothing set, rather than throwing", () => {
    expect(marketingSettings(undefined)).toEqual(EMPTY_SETTINGS);
    expect(marketingSettings(null)).toEqual(EMPTY_SETTINGS);
    expect(marketingSettings("nonsense")).toEqual(EMPTY_SETTINGS);
    expect(marketingSettings([1, 2])).toEqual(EMPTY_SETTINGS);
  });

  it("keeps what it recognises and drops what it does not", () => {
    const read = marketingSettings({
      templateSlug: "new-kit-reveal-social-post-4-5",
      layoutKey: "new-kit-reveal",
      format: "social-post-4-5",
      words: { headline: "New kit", other: 7 },
      pictures: { mockup: "file-1" },
      colours: { primary: "#1b2a49", nonsense: "#000000" },
      fills: { backdrop: "fill-1" },
      layers: [{ slotId: "headline", hidden: true, locked: false, opacity: 40 }, { nope: 1 }],
      export: { targetKey: "png-2x", dpi: 300, format: "pdf", colourSpace: "cmyk", removeBackground: true },
    });

    expect(read.words).toEqual({ headline: "New kit" });
    expect(read.colours).toEqual({ primary: "#1b2a49" });
    expect(read.layers).toEqual([{ slotId: "headline", hidden: true, locked: false, opacity: 40 }]);
    expect(read.export).toEqual({ targetKey: "png-2x", dpi: 300, format: "pdf", colourSpace: "cmyk", removeBackground: true });
  });

  it("reads a format or an export choice it does not know as the default", () => {
    const read = marketingSettings({ format: "tiktok-9-16", export: { dpi: -5, format: "tiff", colourSpace: "lab" } });
    expect(read.format).toBeNull();
    expect(read.export).toEqual({ targetKey: null, dpi: 72, format: "png", colourSpace: "rgb", removeBackground: false });
  });

  it("reads an opacity outside 0 to 100 as whole, so a layer is never half-set", () => {
    expect(marketingSettings({ layers: [{ slotId: "a", opacity: 140 }] }).layers[0]!.opacity).toBe(100);
    expect(marketingSettings({ layers: [{ slotId: "a", opacity: 33.6 }] }).layers[0]!.opacity).toBe(34);
  });

  it("hands the shell a plain record, which is what the command takes", () => {
    expect(asSettings(EMPTY_SETTINGS)).toEqual({ ...EMPTY_SETTINGS });
  });
});

describe("changing a board's settings", () => {
  it("takes on a layout and clears what the last one held, keeping the export choices", () => {
    const before = withExport({ ...EMPTY_SETTINGS, words: { headline: "Old" } }, { dpi: 300 });
    const after = withTemplate(before, { slug: "new-kit-reveal-story-9-16", layoutKey: "new-kit-reveal", format: "story-9-16" });

    expect(after.words).toEqual({});
    expect(after.layoutKey).toBe("new-kit-reveal");
    expect(after.export.dpi).toBe(300);
  });

  it("writes words into a text slot, and refuses more than the field takes", () => {
    const ok = withWords(EMPTY_SETTINGS, headline(), "New kit. Out Friday.");
    expect(ok.ok && ok.settings.words.headline).toBe("New kit. Out Friday.");

    const long = withWords(EMPTY_SETTINGS, headline(), "x".repeat(41));
    expect(long.ok ? "" : long.reason).toBe("Headline takes up to 40 characters.");
  });

  it("refuses words in a slot that holds no words", () => {
    const verdict = withWords(EMPTY_SETTINGS, mockup(), "New kit");
    expect(verdict.ok ? "" : verdict.reason).toBe("Mockup does not take that.");
  });

  it("writes a picture the platform drew, and refuses one a model made", () => {
    const ok = withPicture(EMPTY_SETTINGS, mockup(), picture);
    expect(ok.ok && ok.settings.pictures.mockup).toBe("file-1");

    const generated = withPicture(EMPTY_SETTINGS, mockup(), { ...picture, provenance: "generated" });
    expect(generated.ok ? "" : generated.reason).toContain("never becomes the picture in a layout");
  });

  it("refuses a picture in a slot that holds words", () => {
    expect(withPicture(EMPTY_SETTINGS, headline(), picture).ok).toBe(false);
  });

  it("sets several colour roles at once, which is what one click of a palette does", () => {
    const after = withColours(EMPTY_SETTINGS, { primary: "#c8102e", background: "#ffffff" });
    expect(after.colours).toEqual({ primary: "#c8102e", background: "#ffffff" });
    expect(withColours(after, { primary: "#000000" }).colours.background).toBe("#ffffff");
  });

  it("fills a shape with a repeat print, and keeps the export choices apart from it", () => {
    const after = withFill(EMPTY_SETTINGS, "backdrop", "repeat-1");
    expect(after.fills).toEqual({ backdrop: "repeat-1" });
    expect(withExport(after, { removeBackground: true }).export.removeBackground).toBe(true);
  });

  it("takes everything out of one slot and leaves the others", () => {
    const filled = withFill(withPicture(EMPTY_SETTINGS, mockup(), picture).ok ? withPicture(EMPTY_SETTINGS, mockup(), picture).settings : EMPTY_SETTINGS, "backdrop", "repeat-1");
    const after = cleared(filled, "mockup");

    expect(after.pictures).toEqual({});
    expect(after.fills).toEqual({ backdrop: "repeat-1" });
  });
});
