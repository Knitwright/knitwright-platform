import { describe, expect, it } from "vitest";
import { DEFAULT_MIN_DPI } from "@/lib/artwork-intake/settings";
import { articleBook } from "@/lib/teamwear/fixtures/kit";
import {
  CREST_ACCEPT,
  CREST_FORMATS,
  CREST_REFUSALS,
  CREST_WIDTH_MM,
  crestBytes,
  crestDigest,
  KIND_OF,
  readCrest,
  vectoriseCheck,
} from "./crest";
import { crestFileFixture, crestPixels, crestSvgFixture } from "./fixtures/crests";
import { CREST_LIMITS } from "./settings";
import { runCrestToKit } from "./service";

const articles = articleBook();

const pngBytes = (size = 64): Uint8Array => crestFileFixture(0, size).bytes;

describe("reading a crest", () => {
  it("takes the four formats the specification names, and says which print sharp at any size", () => {
    expect(CREST_FORMATS).toEqual(["png", "jpeg", "svg", "pdf"]);
    expect(KIND_OF).toEqual({ png: "raster", jpeg: "raster", svg: "vector", pdf: "vector" });
    for (const format of CREST_FORMATS) expect(CREST_ACCEPT).toContain(format === "jpeg" ? "jpeg" : format);
  });

  it("reads the format from the first bytes, not from the file's name", () => {
    const read = readCrest("logo.svg", pngBytes(), { widthPx: 900, heightPx: 900 });
    expect(read.ok && read.crest.format).toBe("png");
    expect(read.ok && read.crest.kind).toBe("raster");
  });

  it("keeps the pixel size of a picture and none for a drawing", () => {
    const raster = readCrest("c.png", pngBytes(), { widthPx: 900, heightPx: 600 });
    expect(raster.ok && [raster.crest.widthPx, raster.crest.heightPx]).toEqual([900, 600]);
    const drawing = readCrest("c.svg", crestSvgFixture().bytes, { widthPx: 900, heightPx: 600 });
    expect(drawing.ok && [drawing.crest.widthPx, drawing.crest.heightPx]).toEqual([null, null]);
  });

  it("refuses an empty file, one over ten megabytes, and one that is not a picture, each with what to do", () => {
    expect(readCrest("c.png", new Uint8Array(0))).toMatchObject({ ok: false, reason: "empty", message: CREST_REFUSALS.empty });
    const big = new Uint8Array(CREST_LIMITS.maxFileBytes + 1);
    big.set(pngBytes(8));
    expect(readCrest("c.png", big)).toMatchObject({ ok: false, reason: "too-big" });
    expect(readCrest("c.txt", new TextEncoder().encode("hello, this is not a picture at all"))).toMatchObject({ ok: false, reason: "not-accepted" });
    for (const message of Object.values(CREST_REFUSALS)) expect(message).toMatch(/\.$/);
  });
});

describe("the vectorise check", () => {
  it("says a drawing prints sharp at any size and is used as it was sent", () => {
    const check = vectoriseCheck(crestSvgFixture());
    expect(check).toMatchObject({ vector: true, sharpEnough: true, dpi: null, largestWidthMm: null, ruleId: "R-SUB-003" });
    expect(check.message).toContain("exactly as you sent it");
  });

  it("measures a picture against the print rules' own minimum at the width a crest is printed", () => {
    const sharp = vectoriseCheck({ ...crestFileFixture(), widthPx: 1200 });
    expect(sharp.sharpEnough).toBe(true);
    expect(sharp.dpi).toBe(Math.round(1200 / (CREST_WIDTH_MM / 25.4)));
    expect(sharp.message).toContain(String(DEFAULT_MIN_DPI));
  });

  it("flags a picture under the minimum, says how wide it may go, and never offers to redraw it", () => {
    const soft = vectoriseCheck({ ...crestFileFixture(), widthPx: 200 });
    expect(soft.sharpEnough).toBe(false);
    expect(soft.largestWidthMm).toBe(Math.round((200 / DEFAULT_MIN_DPI) * 25.4));
    expect(soft.message).toContain("does not redraw a crest");
  });

  it("says plainly that it cannot judge a picture whose size could not be read", () => {
    const unknown = vectoriseCheck({ ...crestFileFixture(), widthPx: null });
    expect(unknown).toMatchObject({ vector: false, sharpEnough: false, dpi: null });
    expect(unknown.message).toContain("could not be read");
  });
});

describe("the crest is placed unaltered", () => {
  it("hands back the very bytes it was given", () => {
    const bytes = pngBytes(256);
    const read = readCrest("crest.png", bytes, { widthPx: 1200, heightPx: 1200 });
    expect(read.ok && crestBytes(read.crest)).toBe(bytes);
  });

  it("carries a crest through the whole run byte for byte, on every kit", async () => {
    const crest = crestFileFixture(3, 1_024);
    // A copy taken before the run, so a change in place would be caught as well as a replacement.
    const before = Uint8Array.from(crest.bytes);
    const digestBefore = crestDigest(crest);
    const run = await runCrestToKit({
      sportId: "football",
      feel: "bold",
      roles: "all",
      clubName: "Byte-for-byte FC",
      crest,
      pixels: crestPixels(3),
      picked: [],
      articles,
    });
    expect(run.status).toBe("kits");
    if (run.status !== "kits") return;
    expect(run.kits.length).toBeGreaterThan(0);
    for (const { candidate } of run.kits) {
      expect(candidate.crest, candidate.id).not.toBeNull();
      expect(crestDigest(candidate.crest!), candidate.id).toBe(digestBefore);
      expect([...candidate.crest!.bytes], candidate.id).toEqual([...before]);
      // The same array, not a copy: nothing in the run re-encoded or rewrote it.
      expect(candidate.crest!.bytes, candidate.id).toBe(crest.bytes);
    }
    expect([...crest.bytes]).toEqual([...before]);
  });

  it("gives a different digest for a changed byte, so the test above can fail", () => {
    const one = crestFileFixture(1, 128);
    const changed = { ...one, bytes: Uint8Array.from(one.bytes) };
    changed.bytes[64] = (changed.bytes[64]! + 1) % 256;
    expect(crestDigest(changed)).not.toBe(crestDigest(one));
  });
});
