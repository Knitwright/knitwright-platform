import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { payloadOf } from "@/lib/design-import/payload";
import { importFromPicture } from "@/lib/design-import/pipeline";
import { sideBySideOf } from "@/lib/design-import/side-by-side";
import { starterTemplate } from "@/lib/design-import/template";
import { recordedReading, replayProvider } from "@/lib/design-import/fixtures/fakes";
import { teePicture } from "@/lib/design-import/fixtures/synthetic";
import { DesignFromPicture } from "./DesignFromPicture";
import { SideBySideView } from "./SideBySideView";

async function model() {
  const outcome = await importFromPicture({
    raster: teePicture({ garment: [27, 42, 73] }),
    image: { mediaType: "image/png", base64: "AAAA" },
    provider: replayProvider(recordedReading()),
    templates: starterTemplate,
    size: "M",
  });
  const reading = payloadOf({
    id: "a", projectId: "b", sourceFileId: "c", status: "ready", report: outcome.report, stack: outcome.stack, stored: outcome.stored,
    error: null, acceptedLayers: [], acceptedAt: null, createdAt: "x",
  });
  return sideBySideOf(reading)!;
}

describe("the side-by-side screen", () => {
  it("shows the picture, our drawing, the confidence of each layer and the limits, and says nothing is saved yet", async () => {
    const html = renderToStaticMarkup(createElement(SideBySideView, { model: await model(), pictureUrl: "/api/files/c", busy: false, onMove: vi.fn(), onAccept: vi.fn(), onDiscard: vi.fn() }));
    expect(html).toContain("Close reading of your picture");
    expect(html).toContain("Nothing is saved to your design until you accept it.");
    expect(html).toContain("Your picture");
    expect(html).toContain("Our drawing");
    expect(html).toMatch(/Main colour<\/span>: (High|Medium|Low) confidence/);
    expect(html).toContain("The back is not in your picture");
    expect(html).toContain("Logos are redrawn");
    expect(html).toContain("Accept the layers ticked");
    expect(html).toContain("Discard this reading");
    expect(html).not.toMatch(/\bexact\b|matches your picture|identical/i);
  });

  it("offers the first step before anything is read", () => {
    const html = renderToStaticMarkup(createElement(DesignFromPicture, { projectId: "p", fileId: "f" }));
    expect(html).toContain("Make a design from a picture");
    expect(html).toContain("Read my picture");
    expect(html).toContain("close reading, not a copy");
  });
});
