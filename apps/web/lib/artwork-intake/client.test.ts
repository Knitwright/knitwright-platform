import { describe, expect, it, vi } from "vitest";
import { dpiCheck } from "./effective-dpi";
import {
  ARTWORK_ACCEPT, convertArtwork, factsFor, FAILED, listArtwork, readAnswer, readResolution, removeArtworkRequest, resolutionLines, screenLink, UNREACHABLE, uploadArtwork,
} from "./client";
import type { ArtworkSummary } from "./records";

const summary = (patch: Partial<ArtworkSummary> = {}): ArtworkSummary => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Crest",
  kind: "raster",
  sourceFormat: "tiff",
  widthPx: 3000,
  heightPx: 2000,
  dpiMeta: 600,
  naturalWidthMm: null,
  colourSpace: "cmyk",
  colourProfileName: "Chemical proof",
  hasAlpha: false,
  whiteBackground: false,
  warnings: [],
  derivedFrom: null,
  screenFileId: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-10-14T00:00:00Z",
  ...patch,
});

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
const refused = (message: string) => new Response(JSON.stringify({ success: false, error: { message } }), { status: 400 });

describe("readAnswer", () => {
  it("gives the data, the server's own sentence, or a plain fallback", async () => {
    expect(await readAnswer(ok({ a: 1 }))).toEqual({ ok: true, data: { a: 1 } });
    expect(await readAnswer(refused("This SVG contains a script."))).toEqual({ ok: false, message: "This SVG contains a script." });
    expect(await readAnswer(new Response("<html>"))).toEqual({ ok: false, message: FAILED });
    expect(await readAnswer(new Response(JSON.stringify({ success: false, error: {} })))).toEqual({ ok: false, message: FAILED });
  });
});

describe("the requests", () => {
  it("send nothing without the rights box, and send the file and the box with it", async () => {
    const post = vi.fn(async () => ok({ artwork: summary() }));
    const file = new File([new Uint8Array(3)], "crest.png");
    expect((await uploadArtwork(file, false, post)).ok).toBe(false);
    expect(post).not.toHaveBeenCalled();
    expect((await uploadArtwork(file, true, post)).ok).toBe(true);
    const [url, init] = post.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/artwork");
    expect((init.body as FormData).get("rights")).toBe("yes");
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("ask for the other things by their address", async () => {
    const send = vi.fn(async () => ok({}));
    await convertArtwork("a", { action: "check-tile" }, send);
    await readResolution("a", 400, send);
    await screenLink("a", send);
    await listArtwork(send);
    await removeArtworkRequest("a", send);
    expect(send.mock.calls.map((c) => (c as unknown as [string, RequestInit]).slice(0, 2).map((v) => (typeof v === "string" ? v : (v as RequestInit).method)).join(" "))).toEqual([
      "/api/artwork/a/convert POST",
      "/api/artwork/a?widthMm=400 GET",
      "/api/artwork/a/screen GET",
      "/api/artwork GET",
      "/api/artwork/a DELETE",
    ]);
  });

  it("say so when the server cannot be reached", async () => {
    const down = async () => {
      throw new Error("offline");
    };
    expect(await listArtwork(down)).toEqual({ ok: false, message: UNREACHABLE });
  });
});

describe("the words", () => {
  it("accepts the formats the plan names", () => {
    for (const type of [".png", ".tiff", ".pdf", ".ai", ".svg"]) expect(ARTWORK_ACCEPT).toContain(type);
  });

  it("describes a picture and a vector in plain sentences", () => {
    expect(factsFor(summary())).toEqual([
      "TIFF picture, 3,000 x 2,000 pixels.",
      "Colours were CMYK and were converted to sRGB for printing.",
      "Colour profile: Chemical proof.",
      "The file says it was made at 600 dpi.",
    ]);
    expect(factsFor(summary({ colourSpace: "unknown", colourProfileName: null, dpiMeta: null }))).toContain("The file does not say what resolution it was made at.");
    expect(factsFor(summary({ kind: "vector", sourceFormat: "svg", widthPx: 100, heightPx: 50, naturalWidthMm: 26.4 }))).toEqual([
      "SVG, kept as a vector drawing, 100 x 50 pixels.",
      "Its own size is 26 mm wide. A drawing can be printed at any size.",
    ]);
    expect(factsFor(summary({ kind: "vector", sourceFormat: "pdf", naturalWidthMm: null }))).toHaveLength(1);
  });

  it("reads out the resolution, the warning, and where the minimum came from", () => {
    const low = resolutionLines(dpiCheck({ kind: "raster", widthPx: 1000 }, 400));
    expect(low[0]).toBe("At this width it prints at about 64 dpi.");
    expect(low[1]).toContain("so it may look soft");
    expect(low.at(-1)).toBe("Minimum 150 dpi: Knitwright default, not from your print house.");
    const fine = resolutionLines(dpiCheck({ kind: "raster", widthPx: 3000 }, 200));
    expect(fine[1]).toBe("It can print up to 508 mm wide and still reach 150 dpi.");
    expect(resolutionLines(dpiCheck({ kind: "vector", widthPx: 10 }, 200))).toEqual(["This is a drawing, so it prints sharply at any size."]);
  });
});
