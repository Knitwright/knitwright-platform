import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { createFakeSupabase } from "./fixtures/fake-supabase";
import { removeArtworkFiles, writeArtworkFile, type ArtworkFileInput } from "./store";

const BRAND = "11111111-1111-4111-8111-111111111111";
const rights = { confirmedBy: "22222222-2222-4222-8222-222222222222", confirmedAt: "2026-10-14T00:00:00.000Z", wordingVersion: "logo-rights-v1" };

const input = (fake: ReturnType<typeof createFakeSupabase>, patch: Partial<ArtworkFileInput> = {}): ArtworkFileInput => ({
  admin: fake.client,
  brandId: BRAND,
  userId: rights.confirmedBy,
  kind: "artwork",
  contentType: "image/png",
  bytes: Uint8Array.from([1, 2, 3]),
  width: 10,
  height: 5,
  rights,
  ...patch,
});

describe("writeArtworkFile", () => {
  it("stores each kind in its own bucket under the brand's folder, with the rights kept", async () => {
    const fake = createFakeSupabase();
    const small = await writeArtworkFile(input(fake));
    const print = await writeArtworkFile(input(fake, { kind: "artwork-print", contentType: "image/tiff" }));
    const vector = await writeArtworkFile(input(fake, { kind: "artwork-vector", contentType: "application/json", width: null, height: null }));
    expect([small.bucket, print.bucket, vector.bucket]).toEqual(["uploads", "exports", "exports"]);
    expect(small.path).toMatch(new RegExp(`^${BRAND}/artwork/[0-9a-f-]{36}\\.png$`));
    expect(print.path).toMatch(/\/artwork-print\/[0-9a-f-]{36}\.tiff$/);
    expect(vector.path).toMatch(/\/artwork-vector\/[0-9a-f-]{36}\.json$/);
    expect(fake.tables.files[1]).not.toHaveProperty("rights_confirmed_by");
    expect(fake.tables.files[2]).not.toHaveProperty("rights_confirmed_by");
    expect(fake.tables.files[0]).toMatchObject({ brand_id: BRAND, kind: "artwork", rights_confirmed_by: rights.confirmedBy, rights_wording_version: "logo-rights-v1" });
  });

  it("will not store an SVG, or anything a kind does not allow, and writes nothing", async () => {
    const fake = createFakeSupabase();
    for (const contentType of ["image/svg+xml", "text/html", "application/pdf"]) {
      await expect(writeArtworkFile(input(fake, { kind: "artwork-vector", contentType }))).rejects.toThrow("not stored as artwork");
      await expect(writeArtworkFile(input(fake, { kind: "artwork", contentType }))).rejects.toThrow("not stored as artwork");
    }
    await expect(writeArtworkFile(input(fake, { bytes: new Uint8Array(0) }))).rejects.toThrow();
    expect(fake.objects.size).toBe(0);
    expect(fake.tables.files).toHaveLength(0);
  });

  it("refuses when the brand has no room, before sending anything", async () => {
    const fake = createFakeSupabase({}, { usedBytes: 500 * 1024 * 1024 });
    await expect(writeArtworkFile(input(fake))).rejects.toBeInstanceOf(AppError);
    expect(fake.objects.size).toBe(0);
  });

  it("removes the stored object again when its record cannot be written", async () => {
    const fake = createFakeSupabase({}, { failInsertOn: "files" });
    await expect(writeArtworkFile(input(fake))).rejects.toThrow("record could not be written");
    expect(fake.objects.size).toBe(0);
  });

});

describe("removeArtworkFiles", () => {
  it("removes the objects and their records, only for the brand named", async () => {
    const fake = createFakeSupabase();
    const a = await writeArtworkFile(input(fake));
    await removeArtworkFiles(fake.client, "99999999-9999-4999-8999-999999999999", [a]);
    expect(fake.tables.files).toHaveLength(1);
    await removeArtworkFiles(fake.client, BRAND, [a]);
    expect(fake.tables.files).toHaveLength(0);
    expect(fake.objects.size).toBe(0);
  });
});
