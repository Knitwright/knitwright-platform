import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { BRAND_STORAGE_QUOTA_BYTES, QUOTA_ERROR_CODE, STORAGE_FULL_MESSAGE } from "@/lib/storage/quota";
import { storeImage } from "@/lib/storage/store";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * The storage quota of a brand. Security finding S-01; owner decision 2026-09-30: 500 MB.
 * File rows stand in for large files here, so the test does not have to write 500 MB: the
 * quota is kept on the rows, whatever wrote them.
 */

const MB = 1024 * 1024;

let owner: Person;

/** A file row of `bytes` for the brand, as the server writes one after an upload. */
const row = (brandId: string, bytes: number) => {
  const id = randomUUID();
  return {
    id,
    brand_id: brandId,
    bucket: "uploads",
    path: `${brandId}/artwork/${id}.png`,
    kind: "artwork",
    content_type: "image/png",
    bytes,
    created_by: owner.userId,
  };
};

const insert = (brandId: string, bytes: number) => adminClient().from("files").insert(row(brandId, bytes));

const used = async (brandId: string): Promise<number> =>
  Number(must(await adminClient().rpc("brand_storage_used", { p_brand_id: brandId })));

/** A brand of its own person: one person may belong to three brands at most. */
const freshBrand = async (name: string): Promise<string> => brandOf(await person("quota"), name);

const png = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: "#2b46f0" } }).png().toBuffer();

beforeAll(async () => {
  owner = await person("quota");
});

describe("the brand storage quota", () => {
  it("lets a brand fill exactly its 500 MB, and refuses one byte more", async () => {
    const brandId = await freshBrand("Quota Exact");

    expect((await insert(brandId, BRAND_STORAGE_QUOTA_BYTES - 1)).error).toBeNull();
    expect((await insert(brandId, 1)).error).toBeNull();
    const refused = await insert(brandId, 1);

    expect(refused.error?.code).toBe(QUOTA_ERROR_CODE);
    expect(await used(brandId)).toBe(BRAND_STORAGE_QUOTA_BYTES);
  });

  it("holds when many uploads for one brand arrive at once", async () => {
    const brandId = await freshBrand("Quota Race");

    // Twenty files of 30 MB: sixteen fit in 500 MB (480 MB), four do not.
    const results = await Promise.all(Array.from({ length: 20 }, () => insert(brandId, 30 * MB)));

    expect(results.filter((result) => result.error === null)).toHaveLength(16);
    expect(results.filter((result) => result.error?.code === QUOTA_ERROR_CODE)).toHaveLength(4);
    expect(await used(brandId)).toBe(480 * MB);
  });

  it("counts each brand on its own", async () => {
    const full = await freshBrand("Quota Full");
    const other = await freshBrand("Quota Other");
    expect((await insert(full, BRAND_STORAGE_QUOTA_BYTES)).error).toBeNull();

    expect((await insert(other, 10 * MB)).error).toBeNull();
  });

  it("guards a record that is changed to be larger, too", async () => {
    const brandId = await freshBrand("Quota Update");
    const small = row(brandId, 1 * MB);
    expect((await adminClient().from("files").insert(small)).error).toBeNull();

    const grown = await adminClient().from("files").update({ bytes: BRAND_STORAGE_QUOTA_BYTES + 1 }).eq("id", small.id);

    expect(grown.error?.code).toBe(QUOTA_ERROR_CODE);
  });

  it("refuses an upload through storeImage with the plain message, and stores nothing", async () => {
    const brandId = await freshBrand("Quota Upload");
    expect((await insert(brandId, BRAND_STORAGE_QUOTA_BYTES - 10)).error).toBeNull();
    const before = must(await adminClient().from("files").select("id").eq("brand_id", brandId));

    const failure = await storeImage({
      admin: adminClient(),
      brandId,
      userId: owner.userId,
      kind: "artwork",
      bytes: await png(),
      statedType: "image/png",
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ code: "over_quota", message: STORAGE_FULL_MESSAGE });
    const after = must(await adminClient().from("files").select("id").eq("brand_id", brandId));
    expect(after).toHaveLength(before.length);
    const listed = must(await adminClient().storage.from("uploads").list(`${brandId}/artwork`));
    expect(listed).toEqual([]);
  });

  it("lets only the server ask how much a brand uses", async () => {
    const brandId = await freshBrand("Quota Private");

    expect((await anonClient().rpc("brand_storage_used", { p_brand_id: brandId })).error).not.toBeNull();
    expect((await owner.client.rpc("brand_storage_used", { p_brand_id: brandId })).error).not.toBeNull();
  });
});
