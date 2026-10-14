import { describe, expect, it } from "vitest";
import { importFromPicture } from "./pipeline";
import { payloadOf } from "./payload";
import { sideBySideOf, HANDLE_LABELS } from "./side-by-side";
import { starterTemplate } from "./template";
import { recordedReading, replayProvider } from "./fixtures/fakes";
import { teePicture } from "./fixtures/synthetic";
import { LANDMARK_IDS } from "@/lib/production/contract";
import type { ImportRecord } from "./store";

async function record(): Promise<ImportRecord> {
  const outcome = await importFromPicture({
    raster: teePicture({ garment: [27, 42, 73] }),
    image: { mediaType: "image/png", base64: "AAAA" },
    provider: replayProvider(recordedReading()),
    templates: starterTemplate,
    size: "M",
  });
  return {
    id: "a", projectId: "b", sourceFileId: "c", status: "ready", report: outcome.report, stack: outcome.stack, stored: outcome.stored,
    error: null, acceptedLayers: [], acceptedAt: null, createdAt: "2026-10-15T00:00:00Z",
  };
}

describe("sideBySideOf", () => {
  it("shows the confidence of each layer, in words, beside the drawing", async () => {
    const view = sideBySideOf(payloadOf(await record()))!;
    expect(view.heading).toBe("Close reading of your picture");
    expect(view.layers).toHaveLength(1);
    expect(view.layers[0]).toMatchObject({ id: "ground", label: "Main colour" });
    expect(view.layers[0].confidenceText).toMatch(/high|medium|low/i);
    expect(view.layers[0].note.length).toBeGreaterThan(5);
    expect(view.colours[0]).toMatchObject({ role: "Main colour", hex: "#1b2a49" });
  });

  it("gives each view an outline and a handle for every landmark", async () => {
    const view = sideBySideOf(payloadOf(await record()))!;
    expect(view.views).toHaveLength(1);
    expect(view.views[0].outline.split(" ").length).toBeGreaterThan(8);
    expect(view.views[0].ground).toBe("#1b2a49");
    expect(view.views[0].handles.map((h) => h.label)).toContain("Underarm, right");
    expect(view.picture).toEqual({ width: 640, height: 520 });
  });

  it("always carries the limits and what is missing, and never claims a match", async () => {
    const view = sideBySideOf(payloadOf(await record()))!;
    expect(view.limits.length).toBeGreaterThanOrEqual(5);
    expect(view.missing.map((m) => m.view)).toContain("back");
    const all = JSON.stringify(view);
    expect(all).not.toMatch(/\bexact\b|matches your picture|identical/i);
  });

  it("is null while there is nothing to show", async () => {
    const base = payloadOf(await record());
    expect(sideBySideOf({ ...base, stack: null })).toBeNull();
    expect(sideBySideOf({ ...base, report: null })).toBeNull();
    expect(sideBySideOf({ ...base, landmarks: null })).toBeNull();
  });

  it("names every landmark in plain words", () => {
    for (const id of LANDMARK_IDS) expect(HANDLE_LABELS[id].length).toBeGreaterThan(3);
  });
});
