import { beforeAll, describe, expect, it } from "vitest";
import { createArtworkAssetReader } from "@/lib/artwork-intake/asset-reader";
import { intakeArtwork } from "@/lib/artwork-intake/intake";
import { cmykTiff } from "@/lib/artwork-intake/fixtures/images";
import { CLEAN_LOGO, ENTITY_BOMB, WITH_EXTERNAL_HREF, WITH_ONLOAD, WITH_SCRIPT } from "@/lib/artwork-intake/fixtures/svgs";
import { logoRightsFor } from "@/lib/storage/rights";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Workstream W7b (decision 0036): an uploaded SVG is never stored or served, a hostile one writes nothing,
 * a picture keeps a print copy and a screen copy, and every lookup that backs the asset reader is the brand's
 * own. These run against local Supabase, so they read the buckets and tables as they really are.
 */

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const rightsFor = (owner: Person) => {
  const check = logoRightsFor({ kind: "artwork", confirmed: true, userId: owner.userId, now: new Date() });
  if (!check.ok || !check.rights) throw new Error("The rights confirmation was refused.");
  return check.rights;
};

const whoIs = (owner: Person, brandId: string) => ({ admin: adminClient(), brandId, userId: owner.userId, rights: rightsFor(owner) });
const text = (value: string) => new TextEncoder().encode(value);

const filesOf = async (brandId: string) => must(await adminClient().from("files").select("id, bucket, path, kind, content_type").eq("brand_id", brandId));

const objectsIn = async (bucket: string, brandId: string): Promise<number> => {
  let count = 0;
  for (const kind of ["artwork", "artwork-print", "artwork-vector"]) {
    const { data } = await adminClient().storage.from(bucket).list(`${brandId}/${kind}`);
    count += data?.length ?? 0;
  }
  return count;
};

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("alice"), person("bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

describe("the buckets", () => {
  it("never allow an SVG, and the exports bucket takes the TIFF and JSON the intake stores", async () => {
    for (const id of ["exports", "uploads", "images"]) {
      const { data } = await adminClient().storage.getBucket(id);
      expect(data?.allowed_mime_types).not.toContain("image/svg+xml");
    }
    const { data } = await adminClient().storage.getBucket("exports");
    expect(data?.allowed_mime_types).toEqual(expect.arrayContaining(["image/tiff", "application/json"]));
  });

  it("refuse an SVG written straight to them, even by the server", async () => {
    for (const bucket of ["exports", "uploads", "images"]) {
      const { error } = await adminClient().storage.from(bucket).upload(`${aliceBrand}/probe/${Date.now()}.svg`, text(CLEAN_LOGO), { contentType: "image/svg+xml" });
      expect(error, bucket).not.toBeNull();
    }
  });

  it("accept the two new file kinds in the files table", async () => {
    for (const [kind, bucket, type] of [["artwork-print", "exports", "image/tiff"], ["artwork-vector", "exports", "application/json"]] as const) {
      const id = crypto.randomUUID();
      const { error } = await adminClient().from("files").insert({ id, brand_id: aliceBrand, bucket, path: `${aliceBrand}/${kind}/${id}.bin`, kind, content_type: type, bytes: 1, created_by: alice.userId });
      expect(error, kind).toBeNull();
    }
  });
});

describe("a clean SVG logo", () => {
  it("is stored as JSON plus a preview picture, and no SVG is stored or served", async () => {
    const summary = await intakeArtwork(whoIs(alice, aliceBrand), { bytes: text(CLEAN_LOGO), filename: "crest.svg" });
    expect(summary).toMatchObject({ kind: "vector", sourceFormat: "svg" });
    const files = await filesOf(aliceBrand);
    expect(files.some((file) => /svg/i.test(String(file.content_type)) || String(file.path).endsWith(".svg"))).toBe(false);
    const kinds = files.map((file) => `${file.kind}:${file.content_type}`);
    expect(kinds).toEqual(expect.arrayContaining(["artwork-vector:application/json", "artwork:image/png"]));
    const asset = await createArtworkAssetReader(adminClient(), aliceBrand).getAsset(summary.id);
    const stored = Buffer.from((await asset?.readPrintCopy()) as Uint8Array).toString("utf8");
    expect(JSON.parse(stored)).toMatchObject({ kind: "vector", source: "svg" });
    expect(stored).not.toMatch(/<svg|<script|onload=/i);
  });
});

describe("a hostile SVG", () => {
  it.each([
    ["a script", WITH_SCRIPT],
    ["an onload attribute", WITH_ONLOAD],
    ["an external href", WITH_EXTERNAL_HREF],
    ["an entity bomb", ENTITY_BOMB],
  ])("with %s is refused with a sentence and nothing is written to storage", async (_name, file) => {
    const before = { files: (await filesOf(aliceBrand)).length, uploads: await objectsIn("uploads", aliceBrand), exports: await objectsIn("exports", aliceBrand) };
    await expect(intakeArtwork(whoIs(alice, aliceBrand), { bytes: text(file) })).rejects.toMatchObject({ code: "invalid_input" });
    expect({ files: (await filesOf(aliceBrand)).length, uploads: await objectsIn("uploads", aliceBrand), exports: await objectsIn("exports", aliceBrand) }).toEqual(before);
  });
});

describe("a CMYK TIFF", () => {
  it("becomes an sRGB print copy and a screen copy that only its own brand can read", async () => {
    const summary = await intakeArtwork(whoIs(alice, aliceBrand), { bytes: await cmykTiff(), filename: "crest.tif" });
    expect(summary).toMatchObject({ kind: "raster", colourSpace: "cmyk", colourProfileName: "Chemical proof", dpiMeta: 600 });

    const own = await createArtworkAssetReader(alice.client, aliceBrand).getAsset(summary.id);
    expect((await own?.readPrintCopy())?.byteLength).toBeGreaterThan(100);

    // Another member's own client, asking with their own brand or with the owner's: nothing either way.
    expect(await createArtworkAssetReader(bob.client, bobBrand).getAsset(summary.id)).toBeNull();
    expect(await createArtworkAssetReader(bob.client, aliceBrand).getAsset(summary.id)).toBeNull();
    // Even the server's client, told the wrong brand, finds nothing.
    expect(await createArtworkAssetReader(adminClient(), bobBrand).getAsset(summary.id)).toBeNull();
  });

  it("is listed only for its own brand", async () => {
    const mine = must(await alice.client.from("user_artworks").select("brand_id"));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((row) => row.brand_id === aliceBrand)).toBe(true);
    expect(must(await bob.client.from("user_artworks").select("id")).length).toBe(0);
  });
});
