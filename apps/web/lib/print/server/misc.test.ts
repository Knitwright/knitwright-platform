import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { FileReader } from "@/lib/storage/read";
import { TOO_LARGE } from "@/lib/storage/read";
import { composeAssetReaders, createLegacyAssetReader } from "./assets";
import { printZipName, zipHeaders } from "./names";
import { NO_PATTERN_SENTENCE, patternFor } from "./pattern-source";
import { leagueRuleSetInputSchema, printFilesBodySchema, printFilesQuerySchema, printProfileInputSchema } from "./schemas";
import { createFakeAssetReader } from "@/lib/artwork-stack";

describe("zip names", () => {
  it("names the zip after the style number, else the design, keeping headers safe", () => {
    const n = printZipName({ styleNumber: "KW-001", designName: "Polka", version: 3 });
    expect(n.plain).toBe("KW-001-v3-print-files.zip");
    expect(n.folder).toBe("KW-001-v3-print-files");
    expect(printZipName({ styleNumber: "", designName: "Home / Away: 2026", version: 1 }).plain).toBe("Home-Away-2026-v1-print-files.zip");
    expect(printZipName({ styleNumber: "", designName: "///", version: 1 }).plain).toBe("design-v1-print-files.zip");
    expect(printZipName({ styleNumber: "", designName: "Équipe", version: 2 }).original).toBe("Équipe-v2-print-files.zip");
  });
  it("sends a zip as an attachment that nothing may run", () => {
    const h = zipHeaders(printZipName({ styleNumber: "A", designName: "x", version: 1 }), 10);
    expect(h["content-type"]).toBe("application/zip");
    expect(h["content-disposition"]).toMatch(/^attachment;/);
    expect(h["content-security-policy"]).toContain("sandbox");
  });
});

describe("pattern source", () => {
  it("has the two benchmark patterns, unreviewed, and nothing else yet", () => {
    expect(patternFor("team-jersey")?.pattern.sizes).toEqual(["48"]);
    expect(patternFor("crew-tee")?.reviewed).toBe(false);
    expect(patternFor("hoodie")).toBeNull();
    expect(NO_PATTERN_SENTENCE).toMatch(/no pattern/);
  });
});

describe("schemas", () => {
  it("reads a profile with the optional parts left empty", () => {
    expect(printProfileInputSchema.parse({ bleedMm: 15, dpi: 150, minDpi: 150 })).toMatchObject({ maxPrintWidthMm: null, iccFileId: null });
    expect(printProfileInputSchema.safeParse({ bleedMm: -1, dpi: 150, minDpi: 150 }).success).toBe(false);
    expect(printProfileInputSchema.safeParse({ bleedMm: 15, dpi: 20, minDpi: 150 }).success).toBe(false);
  });
  it("reads a download address, lists and all", () => {
    const q = printFilesQuerySchema.parse({ sizes: "48,50", format: "pdf, svg,pdf", view: "back", guides: "off", version: "2" });
    expect(q.format).toEqual(["pdf", "svg"]);
    expect(q.view).toEqual(["back"]);
    expect(q.version).toBe(2);
    expect(printFilesQuerySchema.safeParse({ format: "exe" }).success).toBe(false);
    expect(printFilesQuerySchema.safeParse({ view: "sleeve" }).success).toBe(false);
  });
  it("reads a roster body and a rule set body", () => {
    expect(printFilesBodySchema.safeParse({ rows: [] }).success).toBe(false);
    expect(leagueRuleSetInputSchema.safeParse({ name: "", source: "x", rules: {} }).success).toBe(false);
  });
});

describe("older logo files as assets", () => {
  it("reads a stored picture's size and resolution, and finds nothing for a file that is not there or too large", async () => {
    const png = await sharp({ create: { width: 30, height: 20, channels: 4, background: "#fff" } }).withMetadata({ density: 300 }).png().toBuffer();
    const reader: FileReader = { read: async (id) => (id === "a" ? { bytes: new Uint8Array(png), contentType: "image/png" } : id === "big" ? TOO_LARGE : null) };
    const assets = createLegacyAssetReader(reader);
    const found = await assets.getAsset("a");
    expect(found).toMatchObject({ kind: "raster", widthPx: 30, heightPx: 20, dpiMeta: 300, hasAlpha: true });
    expect((await found!.readPrintCopy()).length).toBeGreaterThan(0);
    expect(await assets.getAsset("big")).toBeNull();
    expect(await assets.getAsset("missing")).toBeNull();
    const junk = createLegacyAssetReader({ read: async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" }) });
    expect(await junk.getAsset("x")).toBeNull();
  });
  it("tries readers in turn", async () => {
    const first = createFakeAssetReader([{ id: "one", kind: "raster", widthPx: 1, heightPx: 1 }]);
    const second = createFakeAssetReader([{ id: "two", kind: "raster", widthPx: 2, heightPx: 2 }]);
    const both = composeAssetReaders(first, second);
    expect((await both.getAsset("two"))?.widthPx).toBe(2);
    expect(await both.getAsset("none")).toBeNull();
  });
});
