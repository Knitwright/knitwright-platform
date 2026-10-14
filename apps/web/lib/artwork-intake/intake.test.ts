import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { logoRightsFor } from "@/lib/storage/rights";
import { ENTITY_BOMB, CLEAN_LOGO, WITH_EXTERNAL_HREF, WITH_ONLOAD, WITH_SCRIPT } from "./fixtures/svgs";
import { cmykTiff, gradientTile, logoOnWhite, solid } from "./fixtures/images";
import { createFakeSupabase } from "./fixtures/fake-supabase";
import { buildPdf, SIMPLE_CONTENT, WITH_JAVASCRIPT } from "./fixtures/pdfs";
import { displayName, intakeArtwork, removeArtwork } from "./intake";
import { ARTWORK_LIMITS } from "./limits";
import { BUSY, withConversionSlot } from "./gate";
import { AI_WITHOUT_PDF } from "./sniff";

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const text = (value: string) => new TextEncoder().encode(value);

const rights = (() => {
  const check = logoRightsFor({ kind: "artwork", confirmed: true, userId: USER, now: new Date("2026-10-14T00:00:00Z") });
  if (!check.ok || !check.rights) throw new Error("rights");
  return check.rights;
})();

const setup = (options?: Parameters<typeof createFakeSupabase>[1]) => {
  const fake = createFakeSupabase({}, options);
  const who = { admin: fake.client, brandId: BRAND, userId: USER, rights };
  return { fake, who };
};

const stored = (fake: ReturnType<typeof createFakeSupabase>) => [...fake.objects.entries()].map(([key, value]) => ({ key, type: value.contentType }));

describe("intakeArtwork, for pictures", () => {
  it("turns a CMYK TIFF into an sRGB print copy and a screen copy, and records the profile", async () => {
    const { fake, who } = setup();
    const summary = await intakeArtwork(who, { bytes: await cmykTiff(), filename: "C:\\art\\Club Crest 600dpi.tif" });
    expect(summary).toMatchObject({ kind: "raster", sourceFormat: "tiff", name: "Club Crest 600dpi", colourSpace: "cmyk", colourProfileName: "Chemical proof", dpiMeta: 600 });
    expect(stored(fake).map((s) => s.type).sort()).toEqual(["image/png", "image/tiff"]);
    const print = [...fake.objects.entries()].find(([, v]) => v.contentType === "image/tiff");
    expect((await sharp(print?.[1].bytes as Uint8Array).metadata()).space).toBe("srgb");
    expect(fake.tables.user_artworks[0]).toMatchObject({ brand_id: BRAND, rights_wording_version: "logo-rights-v1", rights_confirmed_by: USER });
  });

  it("keeps the source hash and the print hash, and never the upload", async () => {
    const { fake, who } = setup();
    const bytes = await solid(40, 30, "#2255aa");
    await intakeArtwork(who, { bytes });
    const row = fake.tables.user_artworks[0];
    expect(row.source_sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(row.print_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.source_sha256).not.toBe(row.print_sha256);
    expect([...fake.objects.values()].some((o) => Buffer.from(o.bytes).equals(bytes))).toBe(false);
  });

  it("records a logo on a white box so the person can be offered to remove it", async () => {
    const { who } = setup();
    expect(await intakeArtwork(who, { bytes: await logoOnWhite() })).toMatchObject({ whiteBackground: true });
  });

  it("lists a derived artwork's parent", async () => {
    const { who } = setup();
    const first = await intakeArtwork(who, { bytes: await solid(20, 20, "#abcdef") });
    const second = await intakeArtwork(who, { bytes: await solid(20, 20, "#abcdef"), derivedFrom: first.id });
    expect(second.derivedFrom).toBe(first.id);
  });
});

describe("intakeArtwork, for vectors", () => {
  it("stores a clean SVG logo as JSON plus a preview, and no SVG is stored or served", async () => {
    const { fake, who } = setup();
    const summary = await intakeArtwork(who, { bytes: text(CLEAN_LOGO), filename: "crest.svg" });
    expect(summary).toMatchObject({ kind: "vector", sourceFormat: "svg", hasAlpha: true, dpiMeta: null });
    expect(stored(fake).map((s) => s.type).sort()).toEqual(["application/json", "image/png"]);
    expect(stored(fake).some((s) => /svg|html|xml/i.test(s.type))).toBe(false);
    for (const row of fake.tables.files) expect(String(row.content_type)).not.toMatch(/svg/i);
    const json = [...fake.objects.values()].find((o) => o.contentType === "application/json");
    expect(Buffer.from(json?.bytes as Uint8Array).toString("utf8")).not.toMatch(/<svg|<script|onload/i);
  });

  it.each([
    ["a script", WITH_SCRIPT],
    ["an onload", WITH_ONLOAD],
    ["an external href", WITH_EXTERNAL_HREF],
    ["an entity bomb", ENTITY_BOMB],
  ])("refuses an SVG with %s with a sentence, and nothing is written to storage", async (_name, file) => {
    const { fake, who } = setup();
    await expect(intakeArtwork(who, { bytes: text(file) })).rejects.toMatchObject({ code: "invalid_input" });
    expect(fake.objects.size).toBe(0);
    expect(fake.tables.files).toHaveLength(0);
    expect(fake.tables.user_artworks).toHaveLength(0);
  });

  it("drops a PDF's JavaScript, says so, and keeps only the drawing", async () => {
    const { fake, who } = setup();
    const summary = await intakeArtwork(who, { bytes: WITH_JAVASCRIPT });
    expect(summary).toMatchObject({ kind: "vector", sourceFormat: "pdf" });
    expect(summary.warnings.join(" ")).toMatch(/scripts or actions/);
    for (const object of fake.objects.values()) expect(Buffer.from(object.bytes).toString("latin1")).not.toMatch(/JavaScript|app\.alert/);
  });

  it("takes a simple PDF and an Illustrator file saved with PDF compatibility alike", async () => {
    const { who } = setup();
    expect(await intakeArtwork(who, { bytes: buildPdf(SIMPLE_CONTENT) })).toMatchObject({ sourceFormat: "pdf", naturalWidthMm: 70.556 });
  });
});

describe("intakeArtwork, refusals", () => {
  it("refuses a native Illustrator file, an empty file, a file over the limit and a file that is not artwork", async () => {
    const { fake, who } = setup();
    await expect(intakeArtwork(who, { bytes: text("%!PS-Adobe-3.0 Illustrator") })).rejects.toMatchObject({ message: AI_WITHOUT_PDF });
    await expect(intakeArtwork(who, { bytes: new Uint8Array(0) })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(intakeArtwork(who, { bytes: new Uint8Array(ARTWORK_LIMITS.maxBytes + 1) })).rejects.toMatchObject({ code: "too_large" });
    await expect(intakeArtwork(who, { bytes: text("MZ not a picture") })).rejects.toMatchObject({ code: "invalid_input" });
    expect(fake.objects.size).toBe(0);
  });

  it("reads the type from the bytes, not the name: a script named logo.png is refused", async () => {
    const { fake, who } = setup();
    await expect(intakeArtwork(who, { bytes: text("<script>alert(1)</script>"), filename: "logo.png" })).rejects.toBeTruthy();
    expect(fake.objects.size).toBe(0);
  });

  it("removes the files already written when the artwork's record cannot be written", async () => {
    const { fake, who } = setup({ failInsertOn: "user_artworks" });
    await expect(intakeArtwork(who, { bytes: await solid(20, 20, "#123456") })).rejects.toThrow("record could not be written");
    expect(fake.objects.size).toBe(0);
    expect(fake.tables.files).toHaveLength(0);
  });

  it("limits how many files one brand has in preparation at once", async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => (release = resolve));
    const first = withConversionSlot("busy-brand", () => hold, 1);
    await expect(withConversionSlot("busy-brand", async () => 1, 1)).rejects.toMatchObject({ code: "rate_limited", message: BUSY });
    await expect(withConversionSlot("another-brand", async () => 2, 1)).resolves.toBe(2);
    release();
    await first;
    await expect(withConversionSlot("busy-brand", async () => 3, 1)).resolves.toBe(3);
  });
});

describe("displayName", () => {
  it("keeps a name to recognise it by, without folders, extension or control characters", () => {
    expect(displayName("/home/a/Club  Crest.final.PNG")).toBe("Club Crest.final");
    expect(displayName("..\\..\\etc\\passwd")).toBe("passwd");
    expect(displayName("a\u0000b\u0007c.svg")).toBe("abc");
    expect(displayName(undefined)).toBe("Artwork");
    expect(displayName("   .png")).toBe("Artwork");
    expect(displayName("x".repeat(200) + ".png")).toHaveLength(80);
  });
});

describe("removeArtwork", () => {
  it("removes the row, both files and their records", async () => {
    const { fake, who } = setup();
    const summary = await intakeArtwork(who, { bytes: await gradientTile() });
    const row = fake.tables.user_artworks[0] as { id: string; print_file_id: string; screen_file_id: string };
    await removeArtwork(who.admin, BRAND, row);
    expect(fake.tables.user_artworks).toHaveLength(0);
    expect(fake.tables.files).toHaveLength(0);
    expect(fake.objects.size).toBe(0);
    expect(summary.id).toBe(row.id);
  });
});
