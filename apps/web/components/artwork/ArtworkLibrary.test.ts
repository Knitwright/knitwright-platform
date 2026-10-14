import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArtworkSummary } from "@/lib/artwork-intake/records";
import { ArtworkItem } from "./ArtworkItem";
import { ArtworkLibrary } from "./ArtworkLibrary";
import { ArtworkUpload } from "./ArtworkUpload";
import { ResolutionReadout } from "./ResolutionReadout";
import { TileChecker } from "./TileChecker";

const artwork = (patch: Partial<ArtworkSummary> = {}): ArtworkSummary => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Club crest",
  kind: "raster",
  sourceFormat: "png",
  widthPx: 1000,
  heightPx: 800,
  dpiMeta: 72,
  naturalWidthMm: null,
  colourSpace: "unknown",
  colourProfileName: null,
  hasAlpha: false,
  whiteBackground: true,
  warnings: ["No colour profile was in this file, so its colours were treated as sRGB."],
  derivedFrom: null,
  screenFileId: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-10-14T00:00:00Z",
  ...patch,
});

const SETTLED = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;
const noop = () => undefined;

describe("the artwork screens", () => {
  it("ask for the rights box before an upload and name the formats in plain words", () => {
    const html = renderToStaticMarkup(createElement(ArtworkUpload, { onUploaded: noop }));
    expect(html).toContain("I own this logo or have permission to use it on garments.");
    expect(html).toContain("PNG, JPEG, TIFF, PDF or SVG");
    expect(html).toContain("Create PDF compatible file");
    expect(html).toContain("disabled");
  });

  it("show what was found, offer to remove a white box, and read out the sharpness", () => {
    const html = renderToStaticMarkup(createElement(ArtworkItem, { artwork: artwork(), onAdded: noop, onRemoved: noop }));
    expect(html).toContain("Club crest");
    expect(html).toContain("PNG picture, 1,000 x 800 pixels.");
    expect(html).toContain("No colour profile was in this file");
    expect(html).toContain("Remove the white background");
    expect(html).toContain("Check sharpness");
    expect(html).toContain("Check the repeat");
  });

  it("do not offer a white box or a repeat check for a drawing, and say it prints at any size", () => {
    const vector = artwork({ kind: "vector", sourceFormat: "svg", whiteBackground: false, warnings: [] });
    const html = renderToStaticMarkup(createElement(ArtworkItem, { artwork: vector, onAdded: noop, onRemoved: noop }));
    expect(html).not.toContain("Remove the white background");
    expect(html).not.toContain("Check the repeat");
    expect(html).toContain("prints sharply at any size");
    expect(renderToStaticMarkup(createElement(TileChecker, { artwork: vector, onMade: noop }))).toBe("");
    expect(renderToStaticMarkup(createElement(ResolutionReadout, { artworkId: vector.id, kind: "vector" }))).toContain("any size");
  });

  it("start the library loading, with the upload form above it", () => {
    const html = renderToStaticMarkup(createElement(ArtworkLibrary));
    expect(html.indexOf("artwork-heading")).toBeLessThan(html.indexOf("Add your own artwork"));
    expect(html).toContain("Loading your artwork.");
  });

  it("never read as settled", () => {
    for (const html of [
      renderToStaticMarkup(createElement(ArtworkLibrary)),
      renderToStaticMarkup(createElement(ArtworkItem, { artwork: artwork(), onAdded: noop, onRemoved: noop })),
    ]) {
      expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(SETTLED);
    }
  });
});
