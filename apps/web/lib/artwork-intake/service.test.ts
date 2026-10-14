import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { createFakeAdmin, type FakeAdmin } from "./fixtures/fake-admin";
import { logoOnWhite, seamyStripes, solidPng } from "./fixtures/pictures";
import { buildPdf } from "./fixtures/pdf";
import { REFUSALS, SVG_REFUSALS } from "./messages";
import { createAssetReader, readVectorModel } from "./reader";
import { changeArtwork, checkArtworkTile, deleteArtwork, getArtworkDetail, listArtworks, uploadArtwork } from "./service";
import { BRAND_STORAGE_QUOTA_BYTES } from "@/lib/storage/quota";

const BRAND = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const USER = "22222222-2222-4222-8222-222222222222";
const actor = { brandId: BRAND, userId: USER };
const NOW = new Date("2026-10-14T10:00:00Z");
const text = (value: string) => new TextEncoder().encode(value);
const CLEAN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="#c8102e"/></svg>';

let fake: FakeAdmin;
beforeEach(() => {
  fake = createFakeAdmin();
});

const upload = (bytes: Uint8Array, fileName: string, rightsConfirmed = true) =>
  uploadArtwork(fake.admin, actor, { bytes, fileName, rightsConfirmed, now: NOW });

describe("uploadArtwork: rights and refusals leave nothing behind", () => {
  it("asks for the rights statement before reading the file", async () => {
    await expect(upload(await solidPng(10, 10, "#fff"), "a.png", false)).rejects.toMatchObject({ message: REFUSALS.rightsMissing, fields: { rights: [REFUSALS.rightsMissing] } });
    expect(fake.objects.size).toBe(0);
  });

  it.each([
    ["a script", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', SVG_REFUSALS.script],
    ["an event handler", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="1" height="1"/></svg>', SVG_REFUSALS.eventHandler],
    ["an outside address", '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png" width="2" height="2"/></svg>', SVG_REFUSALS.externalReference],
    ["an entity bomb", '<!DOCTYPE svg [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><svg xmlns="http://www.w3.org/2000/svg"><text>&b;</text></svg>', SVG_REFUSALS.entities],
  ])("refuses an SVG with %s with a sentence and writes nothing to storage", async (_name, svg, sentence) => {
    await expect(upload(text(svg), "logo.svg")).rejects.toMatchObject({ message: sentence });
    expect(fake.objects.size).toBe(0);
    expect(fake.tables.files).toHaveLength(0);
    expect(fake.tables.user_artworks).toHaveLength(0);
  });
});

describe("uploadArtwork: a clean SVG", () => {
  it("is stored as JSON and a PNG screen copy, and no SVG is stored or served", async () => {
    const record = await upload(text(CLEAN_SVG), "Crest.svg");
    expect(record).toMatchObject({ kind: "vector", sourceFormat: "svg", label: "Crest", printFileId: null });
    const stored = [...fake.objects.entries()];
    expect(stored).toHaveLength(2);
    for (const file of fake.tables.files) {
      expect(String(file.content_type)).not.toContain("svg");
      expect(String(file.path)).not.toMatch(/\.svg$/);
    }
    expect(fake.tables.files.map((f) => f.kind).sort()).toEqual(["artwork", "artwork-vector"]);
    for (const [, bytes] of stored) expect(Buffer.from(bytes).includes(Buffer.from("<svg"))).toBe(false);
    expect(fake.tables.files.find((f) => f.kind === "artwork-vector")?.bucket).toBe("exports");
  });

  it("is readable again as a vector model through the asset reader", async () => {
    const record = await upload(text(CLEAN_SVG), "Crest.svg");
    const model = await readVectorModel(createAssetReader(fake.admin, BRAND), record.id);
    expect(model?.viewBox).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });
});

describe("uploadArtwork: a picture", () => {
  it("keeps the rights confirmation on the screen copy and the record, and never the file name in a path", async () => {
    const record = await upload(await logoOnWhite(), "../../etc/Crest final.PNG");
    expect(record).toMatchObject({ kind: "raster", label: "Crest final", whiteBackground: true });
    const screen = fake.tables.files.find((f) => f.kind === "artwork");
    expect(screen).toMatchObject({ rights_confirmed_by: USER, rights_wording_version: "logo-rights-v1", brand_id: BRAND });
    expect(fake.tables.files.find((f) => f.kind === "artwork-print")?.rights_confirmed_at).toBeUndefined();
    for (const file of fake.tables.files) expect(String(file.path)).toMatch(new RegExp(`^${BRAND}/artwork(-print)?/[0-9a-f-]{36}\\.(png|tiff)$`));
    expect(fake.tables.user_artworks[0]).toMatchObject({ rights_confirmed_by: USER, created_by: USER });
  });

  it("stores the print copy as TIFF in the exports bucket and the screen copy in uploads", async () => {
    await upload(await solidPng(30, 20, "#2b46f0"), "a.png");
    expect(fake.tables.files.find((f) => f.kind === "artwork-print")).toMatchObject({ bucket: "exports", content_type: "image/tiff" });
    expect(fake.tables.files.find((f) => f.kind === "artwork")).toMatchObject({ bucket: "uploads" });
  });

  it("refuses when the brand has no room, before storing", async () => {
    fake.setUsed(BRAND_STORAGE_QUOTA_BYTES);
    await expect(upload(await solidPng(30, 20, "#2b46f0"), "a.png")).rejects.toMatchObject({ code: "over_quota" });
    expect(fake.objects.size).toBe(0);
  });

  it("removes everything it wrote when a later step fails", async () => {
    fake.failNext("artworks-insert");
    await expect(upload(await solidPng(30, 20, "#2b46f0"), "a.png")).rejects.toThrow(/record could not be written/);
    expect(fake.objects.size).toBe(0);
    expect(fake.tables.files).toHaveLength(0);
    fake.failNext("files-insert");
    await expect(upload(await solidPng(30, 20, "#2b46f0"), "b.png")).rejects.toThrow();
    expect(fake.objects.size).toBe(0);
    fake.failNext("upload");
    await expect(upload(await solidPng(30, 20, "#2b46f0"), "c.png")).rejects.toThrow(/could not be stored/);
    expect(fake.tables.files).toHaveLength(0);
  });

  it("still reports the real failure when cleanup itself fails", async () => {
    fake.failNext("artworks-insert");
    fake.failNext("remove");
    await expect(upload(await solidPng(30, 20, "#2b46f0"), "a.png")).rejects.toThrow(/record could not be written/);
  });
});

describe("the asset reader", () => {
  it("answers for its own brand only, by id", async () => {
    const record = await upload(await solidPng(30, 20, "#2b46f0"), "a.png");
    const own = await createAssetReader(fake.admin, BRAND).getAsset(record.id);
    expect(own).toMatchObject({ id: record.id, kind: "raster", widthPx: 30, heightPx: 20, colourSpace: "srgb", hasAlpha: false });
    expect(await createAssetReader(fake.admin, OTHER).getAsset(record.id)).toBeNull();
    expect(await createAssetReader(fake.admin, BRAND).getAsset("not-an-id")).toBeNull();
    expect(await createAssetReader(fake.admin, BRAND).getAsset("44444444-4444-4444-8444-444444444444")).toBeNull();
  });

  it("gives the full size TIFF as the print copy and a small picture as the screen copy", async () => {
    const record = await upload(await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#2b46f0" } }).png().toBuffer(), "wide.png");
    const asset = (await createAssetReader(fake.admin, BRAND).getAsset(record.id))!;
    expect((await sharp(await asset.readPrintCopy()).metadata()).width).toBe(3000);
    expect((await sharp(await asset.readScreenCopy()).metadata()).width).toBe(2048);
  });

  it("says plainly when a stored file has gone", async () => {
    const record = await upload(await solidPng(30, 20, "#2b46f0"), "a.png");
    fake.objects.clear();
    const asset = (await createAssetReader(fake.admin, BRAND).getAsset(record.id))!;
    await expect(asset.readPrintCopy()).rejects.toThrow(/could not be read/);
    fake.tables.files.length = 0;
    await expect(asset.readScreenCopy()).rejects.toThrow(/screen copy of this artwork is missing/);
    expect(await readVectorModel(createAssetReader(fake.admin, BRAND), record.id)).toBeNull();
  });
});

describe("listing, detail and deletion", () => {
  it("lists the brand's artwork, newest first from the database", async () => {
    await upload(await solidPng(30, 20, "#2b46f0"), "a.png");
    await upload(text(CLEAN_SVG), "b.svg");
    expect((await listArtworks(fake.admin, BRAND)).map((a) => a.label)).toEqual(["a", "b"]);
  });

  it("warns at the dpi a placement would print at, to the nearest 1, with the largest size that works", async () => {
    const record = await upload(await sharp({ create: { width: 1000, height: 500, channels: 3, background: "#2b46f0" } }).png().withMetadata({ density: 72 }).toBuffer(), "photo.png");
    const detail = await getArtworkDetail(fake.admin, BRAND, record.id, { widthMm: 400 });
    expect(detail.effectiveDpi).toBe(64);
    expect(detail.dpiWarning).toContain("about 64 dpi");
    expect(detail.dpiWarning).toContain("150 or more");
    expect((await getArtworkDetail(fake.admin, BRAND, record.id, { widthMm: 100 })).dpiWarning).toBeNull();
    expect((await getArtworkDetail(fake.admin, BRAND, record.id)).dpiWarning).toBeNull();
  });

  it("never warns for a vector and offers to remove a white box only for a picture on one", async () => {
    const vector = await upload(text(CLEAN_SVG), "b.svg");
    expect(await getArtworkDetail(fake.admin, BRAND, vector.id, { widthMm: 1 })).toMatchObject({ dpiWarning: null, effectiveDpi: null, canRemoveWhiteBackground: false });
    const boxed = await upload(await logoOnWhite(), "c.png");
    expect((await getArtworkDetail(fake.admin, BRAND, boxed.id)).canRemoveWhiteBackground).toBe(true);
  });

  it("gives not found for another brand's artwork", async () => {
    const record = await upload(await solidPng(30, 20, "#2b46f0"), "a.png");
    await expect(getArtworkDetail(fake.admin, OTHER, record.id)).rejects.toMatchObject({ code: "not_found", message: REFUSALS.noSuchArtwork });
    await expect(deleteArtwork(fake.admin, OTHER, record.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("deletes the record and all its files", async () => {
    const record = await upload(await solidPng(30, 20, "#2b46f0"), "a.png");
    await deleteArtwork(fake.admin, BRAND, record.id);
    expect(fake.objects.size).toBe(0);
    expect(fake.tables.files).toHaveLength(0);
    expect(fake.tables.user_artworks).toHaveLength(0);
  });
});

describe("changing a picture", () => {
  it("shows a 3 x 3 preview and the mismatch before and after without storing, then stores a new artwork when accepted", async () => {
    const tile = await upload(await seamyStripes(64, 32), "tile.png");
    const before = fake.tables.files.length;
    expect((await checkArtworkTile(fake.admin, actor, tile.id)).seamless).toBe(false);
    const shown = await changeArtwork(fake.admin, actor, tile.id, { action: "make-seamless", method: "blend" }, false);
    expect(shown.accepted).toBe(false);
    if (shown.accepted) throw new Error("unreachable");
    expect(shown.summary.after!.mismatch).toBeLessThan(shown.summary.before!.mismatch);
    expect(shown.summary.previewPng).toMatch(/^data:image\/png;base64,/);
    expect(shown.summary.method).toBe("blend");
    expect(shown.summary.limit).toContain("cannot be fixed convincingly");
    expect(fake.tables.files).toHaveLength(before);
    const done = await changeArtwork(fake.admin, actor, tile.id, { action: "make-seamless", method: "mirror" }, true);
    expect(done.accepted && done.artwork.label).toBe("tile (seamless)");
    expect(fake.tables.user_artworks).toHaveLength(2);
    expect(fake.tables.user_artworks[1]).toMatchObject({ rights_confirmed_by: USER });
  });

  it("removes a white box into a new artwork and leaves the first as it was", async () => {
    const boxed = await upload(await logoOnWhite(), "crest.png");
    const shown = await changeArtwork(fake.admin, actor, boxed.id, { action: "remove-white-background" }, false);
    expect(shown.accepted).toBe(false);
    const done = await changeArtwork(fake.admin, actor, boxed.id, { action: "remove-white-background" }, true);
    expect(done.accepted && done.artwork).toMatchObject({ hasAlpha: true, label: "crest (no white box)" });
    expect(fake.tables.user_artworks).toHaveLength(2);
  });

  it("only changes pictures, not vectors", async () => {
    const vector = await upload(text(CLEAN_SVG), "b.svg");
    await expect(changeArtwork(fake.admin, actor, vector.id, { action: "remove-white-background" }, false)).rejects.toMatchObject({ message: REFUSALS.notATile });
  });

  it("turns away a PDF's artwork of a script without storing anything", async () => {
    await expect(upload(buildPdf({ openScript: "app.alert(1)" }), "x.pdf")).rejects.toMatchObject({ message: REFUSALS.pdfScript });
    expect(fake.objects.size).toBe(0);
  });
});
