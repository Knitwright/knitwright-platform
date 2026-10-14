import { describe, expect, it } from "vitest";
import { logoRightsFor } from "@/lib/storage/rights";
import { createArtworkAssetReader } from "./asset-reader";
import { createFakeSupabase } from "./fixtures/fake-supabase";
import { cmykTiff } from "./fixtures/images";
import { CLEAN_LOGO } from "./fixtures/svgs";
import { intakeArtwork } from "./intake";
import { ARTWORK_NOT_FOUND, getArtworkRow, listArtworks } from "./records";

const MINE = "11111111-1111-4111-8111-111111111111";
const THEIRS = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";

const rights = (() => {
  const check = logoRightsFor({ kind: "artwork", confirmed: true, userId: USER, now: new Date("2026-10-14T00:00:00Z") });
  if (!check.ok || !check.rights) throw new Error("rights");
  return check.rights;
})();

async function twoBrands() {
  const fake = createFakeSupabase();
  const mine = await intakeArtwork({ admin: fake.client, brandId: MINE, userId: USER, rights }, { bytes: await cmykTiff(), filename: "mine.tif" });
  const theirs = await intakeArtwork({ admin: fake.client, brandId: THEIRS, userId: USER, rights }, { bytes: new TextEncoder().encode(CLEAN_LOGO), filename: "theirs.svg" });
  return { fake, mine, theirs };
}

describe("createArtworkAssetReader", () => {
  it("gives an asset of the brand, with its facts and both copies", async () => {
    const { fake, mine } = await twoBrands();
    const asset = await createArtworkAssetReader(fake.client, MINE).getAsset(mine.id);
    expect(asset).toMatchObject({ id: mine.id, kind: "raster", dpiMeta: 600, colourSpace: "cmyk", hasAlpha: false });
    expect((await asset?.readPrintCopy())?.byteLength).toBeGreaterThan(100);
    expect((await asset?.readScreenCopy())?.byteLength).toBeGreaterThan(100);
  });

  it("reads a vector asset's print copy as its JSON", async () => {
    const { fake, theirs } = await twoBrands();
    const asset = await createArtworkAssetReader(fake.client, THEIRS).getAsset(theirs.id);
    expect(asset?.kind).toBe("vector");
    expect(JSON.parse(Buffer.from((await asset?.readPrintCopy()) as Uint8Array).toString("utf8"))).toMatchObject({ kind: "vector", source: "svg" });
  });

  it("gives nothing for another brand's asset, a missing one, or an id that is not an id", async () => {
    const { fake, mine, theirs } = await twoBrands();
    const reader = createArtworkAssetReader(fake.client, MINE);
    expect(await reader.getAsset(theirs.id)).toBeNull();
    expect(await reader.getAsset("00000000-0000-4000-8000-00000000ffff")).toBeNull();
    expect(await reader.getAsset("not-an-id")).toBeNull();
    expect(await reader.getAsset("' or 1=1 --")).toBeNull();
    expect(await createArtworkAssetReader(fake.client, THEIRS).getAsset(mine.id)).toBeNull();
  });

  it("names the brand in every lookup it makes: the artwork row and each file", async () => {
    const { fake, mine } = await twoBrands();
    fake.queries.length = 0;
    const asset = await createArtworkAssetReader(fake.client, MINE).getAsset(mine.id);
    await asset?.readPrintCopy();
    await asset?.readScreenCopy();
    const reads = fake.queries.filter((q) => q.kind === "select");
    expect(reads.map((q) => q.table)).toEqual(["user_artworks", "files", "files"]);
    for (const read of reads) expect(read.filters).toContainEqual(["brand_id", MINE]);
  });

  it("cannot be tricked into reading another brand's file through a row that points at it", async () => {
    const { fake, mine, theirs } = await twoBrands();
    const theirsRow = fake.tables.user_artworks.find((r) => r.id === theirs.id) as { print_file_id: string };
    const mineRow = fake.tables.user_artworks.find((r) => r.id === mine.id) as { print_file_id: string };
    mineRow.print_file_id = theirsRow.print_file_id;
    const asset = await createArtworkAssetReader(fake.client, MINE).getAsset(mine.id);
    await expect(asset?.readPrintCopy()).rejects.toThrow("could not be found");
  });

  it("reports a stored object that is missing", async () => {
    const { fake, mine } = await twoBrands();
    fake.objects.clear();
    const asset = await createArtworkAssetReader(fake.client, MINE).getAsset(mine.id);
    await expect(asset?.readScreenCopy()).rejects.toThrow("could not be read");
  });
});

describe("records", () => {
  it("lists only the brand's artworks, and names the brand in the query", async () => {
    const { fake, mine } = await twoBrands();
    fake.queries.length = 0;
    const list = await listArtworks(fake.client, MINE);
    expect(list.map((a) => a.id)).toEqual([mine.id]);
    expect(fake.queries[0].filters).toContainEqual(["brand_id", MINE]);
    expect(JSON.stringify(list)).not.toMatch(/sha256|path/);
  });

  it("answers the same for a missing artwork and another brand's", async () => {
    const { fake, theirs } = await twoBrands();
    await expect(getArtworkRow(fake.client, MINE, theirs.id)).rejects.toMatchObject({ code: "not_found", message: ARTWORK_NOT_FOUND });
    await expect(getArtworkRow(fake.client, MINE, "00000000-0000-4000-8000-00000000ffff")).rejects.toMatchObject({ code: "not_found", message: ARTWORK_NOT_FOUND });
    await expect(getArtworkRow(fake.client, MINE, "x")).rejects.toMatchObject({ message: ARTWORK_NOT_FOUND });
  });

  it("refuses a row the database shaped unexpectedly", async () => {
    const { fake, mine } = await twoBrands();
    (fake.tables.user_artworks[0] as { width_px: unknown }).width_px = "wide";
    await expect(getArtworkRow(fake.client, MINE, mine.id)).rejects.toThrow("unexpected answer");
  });
});
