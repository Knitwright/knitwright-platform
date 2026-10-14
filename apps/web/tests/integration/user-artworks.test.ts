import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { createAssetReader, readVectorModel } from "@/lib/artwork-intake";
import { deleteArtwork, listArtworks, uploadArtwork } from "@/lib/artwork-intake/service";
import { adminClient, brandOf, person, type Person } from "./support";

/**
 * Migration 20261015060100 and the artwork intake through the real database and storage (W7b).
 * The hard rule: an SVG is never stored or served, and a refused file leaves nothing behind.
 */

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const text = (value: string) => new TextEncoder().encode(value);
const CLEAN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><circle cx="50" cy="25" r="20" fill="#c8102e"/></svg>';
const NOW = new Date();

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("artwork-alice"), person("artwork-bob")]);
  aliceBrand = await brandOf(alice, "Alice Artwork");
  bobBrand = await brandOf(bob, "Bob Artwork");
});

const upload = (brandId: string, who: Person, bytes: Uint8Array, fileName: string) =>
  uploadArtwork(adminClient(), { brandId, userId: who.userId }, { bytes, fileName, rightsConfirmed: true, now: NOW });

/** Every object the brand has in the three buckets. */
const storedObjects = async (brandId: string): Promise<string[]> => {
  const found: string[] = [];
  for (const bucket of ["uploads", "images", "exports"]) {
    for (const kind of ["artwork", "artwork-print", "artwork-vector"]) {
      const { data } = await adminClient().storage.from(bucket).list(`${brandId}/${kind}`);
      found.push(...(data ?? []).map((entry) => `${bucket}/${brandId}/${kind}/${entry.name}`));
    }
  }
  return found;
};

describe("a refused file leaves nothing in storage", () => {
  it.each([
    ["a script", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ["onload", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="1" height="1"/></svg>'],
    ["an external href", '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png" width="2" height="2"/></svg>'],
    ["an entity bomb", '<!DOCTYPE svg [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><svg xmlns="http://www.w3.org/2000/svg"><text>&b;</text></svg>'],
  ])("%s", async (_name, svg) => {
    const before = await storedObjects(aliceBrand);
    const filesBefore = await adminClient().from("files").select("id", { count: "exact", head: true }).eq("brand_id", aliceBrand);
    await expect(upload(aliceBrand, alice, text(svg), "bad.svg")).rejects.toMatchObject({ code: "invalid_input" });
    expect(await storedObjects(aliceBrand)).toEqual(before);
    const filesAfter = await adminClient().from("files").select("id", { count: "exact", head: true }).eq("brand_id", aliceBrand);
    expect(filesAfter.count).toBe(filesBefore.count);
  });
});

describe("a clean SVG logo", () => {
  it("is stored as JSON plus a PNG, and no SVG is stored or served", async () => {
    const record = await upload(aliceBrand, alice, text(CLEAN_SVG), "Crest.svg");
    expect(record).toMatchObject({ kind: "vector", sourceFormat: "svg" });

    const { data: files } = await adminClient().from("files").select("kind, bucket, path, content_type").eq("brand_id", aliceBrand);
    expect((files ?? []).filter((file) => ["artwork", "artwork-vector"].includes(String(file.kind))).length).toBeGreaterThanOrEqual(2);
    for (const file of files ?? []) {
      expect(String(file.content_type)).not.toContain("svg");
      expect(String(file.path)).not.toMatch(/\.svg$/i);
    }
    expect(files?.find((file) => file.kind === "artwork-vector")).toMatchObject({ bucket: "exports", content_type: "application/json" });

    // Every stored object for the brand is a PNG, JPEG, TIFF or JSON, whatever its name.
    for (const path of await storedObjects(aliceBrand)) expect(path).toMatch(/\.(png|jpg|tiff|json)$/);
  });

  it("is read back as a vector model by the asset reader", async () => {
    const [record] = await listArtworks(alice.client, aliceBrand);
    const model = await readVectorModel(createAssetReader(adminClient(), aliceBrand), record.id);
    expect(model?.viewBox.width).toBe(100);
  });

  it("is not served as SVG by the buckets, which do not allow it", async () => {
    for (const bucket of ["uploads", "exports"]) {
      const { data } = await adminClient().storage.getBucket(bucket);
      expect(data?.allowed_mime_types).not.toContain("image/svg+xml");
    }
    const { data: exports } = await adminClient().storage.getBucket("exports");
    expect(exports?.allowed_mime_types).toContain("application/json");
    expect(exports?.allowed_mime_types).toContain("image/tiff");
    const attempt = await adminClient().storage.from("exports").upload(`${aliceBrand}/artwork-vector/direct.svg`, text(CLEAN_SVG), { contentType: "image/svg+xml" });
    expect(attempt.error).not.toBeNull();
  });
});

describe("a picture", () => {
  it("is stored as a full size TIFF and a screen copy, with the rights kept on the screen copy", async () => {
    const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#2b46f0" } }).png().toBuffer();
    const record = await upload(aliceBrand, alice, png, "Home kit.png");
    const asset = await createAssetReader(adminClient(), aliceBrand).getAsset(record.id);
    expect((await sharp(await asset!.readPrintCopy()).metadata()).width).toBe(3000);
    expect((await sharp(await asset!.readScreenCopy()).metadata()).width).toBe(2048);
    const { data: screen } = await adminClient().from("files").select("rights_confirmed_by, rights_wording_version").eq("id", record.screenFileId).single();
    expect(screen).toMatchObject({ rights_confirmed_by: alice.userId, rights_wording_version: "logo-rights-v1" });
  });
});

describe("brands stay apart", () => {
  it("lets a member read their brand's artwork records and nobody else's", async () => {
    await upload(bobBrand, bob, text(CLEAN_SVG), "Bob crest.svg");
    expect((await listArtworks(alice.client, aliceBrand)).every((artwork) => artwork.brandId === aliceBrand)).toBe(true);
    const crossed = await alice.client.from("user_artworks").select("id").eq("brand_id", bobBrand);
    expect(crossed.data).toEqual([]);
  });

  it("gives another brand's asset id the same answer as no asset", async () => {
    const [bobs] = await listArtworks(bob.client, bobBrand);
    expect(await createAssetReader(adminClient(), aliceBrand).getAsset(bobs.id)).toBeNull();
  });

  it("refuses a browser that writes to the table", async () => {
    const [mine] = await listArtworks(alice.client, aliceBrand);
    expect((await alice.client.from("user_artworks").update({ label: "Changed" }).eq("id", mine.id)).error).not.toBeNull();
    expect((await alice.client.from("user_artworks").delete().eq("id", mine.id)).error).not.toBeNull();
    expect((await alice.client.from("user_artworks").insert({ brand_id: aliceBrand, label: "Direct" })).error).not.toBeNull();
    const { data } = await adminClient().from("user_artworks").select("label").eq("id", mine.id).single();
    expect(data?.label).not.toBe("Changed");
  });
});

describe("the table's own rules", () => {
  it("needs the right copy for the kind, and the logo rights words", async () => {
    const { data: fileId } = await adminClient().from("files").select("id").eq("brand_id", aliceBrand).limit(1).single();
    const base = {
      brand_id: aliceBrand, kind: "raster", source_format: "png", label: "x", source_sha256: "a".repeat(64), print_sha256: "b".repeat(64),
      screen_file_id: fileId?.id, width_px: 1, height_px: 1, colour_space: "srgb", has_alpha: false,
      rights_confirmed_by: alice.userId, rights_confirmed_at: NOW.toISOString(), rights_wording_version: "logo-rights-v1", created_by: alice.userId,
    };
    // A raster with no print copy.
    expect((await adminClient().from("user_artworks").insert(base)).error).not.toBeNull();
    // Words that are not the logo rights words.
    expect((await adminClient().from("user_artworks").insert({ ...base, kind: "vector", vector_file_id: fileId?.id, rights_wording_version: "marketing-email-v1" })).error).not.toBeNull();
    // A picture over the size limit.
    expect((await adminClient().from("user_artworks").insert({ ...base, kind: "vector", vector_file_id: fileId?.id, width_px: 12001 })).error).not.toBeNull();
  });

  it("removes the record and the files together", async () => {
    const record = await upload(aliceBrand, alice, text(CLEAN_SVG), "Temp.svg");
    await deleteArtwork(adminClient(), aliceBrand, record.id);
    const { data } = await adminClient().from("user_artworks").select("id").eq("id", record.id);
    expect(data).toEqual([]);
    const { data: files } = await adminClient().from("files").select("id").in("id", [record.screenFileId, record.vectorFileId as string]);
    expect(files).toEqual([]);
  });
});
