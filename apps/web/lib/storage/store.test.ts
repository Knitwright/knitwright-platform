import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { BRAND_STORAGE_QUOTA_BYTES, QUOTA_ERROR_CODE, STORAGE_FULL_MESSAGE } from "./quota";
import { storeChartFile, storeImage } from "./store";

const recordError = { message: "insert failed", code: "23503" };

/** The brand stores nothing yet. */
const noneUsed = async () => ({ data: 0, error: null });

// A hand-written stand-in: the real client cannot be made to fail in this order.
const adminWhere = (removal: () => Promise<unknown>) => {
  const remove = vi.fn(removal);
  const admin = {
    rpc: noneUsed,
    storage: {
      from: () => ({ upload: async () => ({ error: null }), remove, list: async () => ({ data: [], error: null }) }),
    },
    from: () => ({ insert: async () => ({ error: recordError }) }),
  } as unknown as SupabaseClient;
  return { admin, remove };
};

const png = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: "#2b46f0" } })
    .png()
    .toBuffer();

const input = async (admin: SupabaseClient) => ({
  admin,
  brandId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  kind: "artwork" as const,
  bytes: await png(),
  statedType: "image/png",
});

describe("storeImage, when the record cannot be written", () => {
  it("removes the file and says the record could not be written", async () => {
    const { admin, remove } = adminWhere(async () => ({ error: null }));

    const failure = await storeImage(await input(admin)).catch((error: unknown) => error);

    expect(remove).toHaveBeenCalledOnce();
    expect(failure).toMatchObject({
      message: "The file's record could not be written.",
      cause: recordError,
    });
  });

  it("still reports the record when the cleanup itself throws", async () => {
    const { admin, remove } = adminWhere(async () => {
      throw new Error("storage is down");
    });

    const failure = await storeImage(await input(admin)).catch((error: unknown) => error);

    expect(remove).toHaveBeenCalledOnce();
    expect(failure).toMatchObject({
      message: "The file's record could not be written.",
      cause: recordError,
    });
  });
});

// A stand-in whose storage and records both succeed, and which remembers what was stored.
const workingAdmin = () => {
  const uploads: { path: string; type: string | undefined }[] = [];
  const admin = {
    rpc: noneUsed,
    storage: {
      from: () => ({
        upload: async (path: string, _bytes: Uint8Array, options: { contentType?: string }) => {
          uploads.push({ path, type: options.contentType });
          return { error: null };
        },
        list: async () => ({ data: [], error: null }),
      }),
    },
    from: () => ({ insert: async () => ({ error: null }) }),
  } as unknown as SupabaseClient;
  return { admin, uploads };
};

describe("storeImage, the type the browser stated", () => {
  it("does not matter for a real image, even when it is empty", async () => {
    for (const stated of ["", "application/octet-stream", "image/svg+xml", "text/html"]) {
      const { admin, uploads } = workingAdmin();

      const file = await storeImage({ ...(await input(admin)), statedType: stated });

      expect(file.contentType).toBe("image/png");
      expect(uploads).toEqual([{ path: expect.stringMatching(/\.png$/), type: "image/png" }]);
    }
  });

  it("does not make a file that is not an image acceptable", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    for (const stated of ["", "image/png", "image/webp"]) {
      const { admin, uploads } = workingAdmin();

      await expect(storeImage({ ...(await input(admin)), bytes: svg, statedType: stated })).rejects.toMatchObject({
        code: "invalid_input",
      });
      expect(uploads).toEqual([]);
    }
  });
});

describe("storeChartFile", () => {
  const recording = () => {
    const uploads: { path: string; type: string }[] = [];
    const records: Record<string, unknown>[] = [];
    const admin = {
      rpc: noneUsed,
      storage: {
        from: () => ({
          upload: async (path: string, _bytes: Uint8Array, options: { contentType: string }) => {
            uploads.push({ path, type: options.contentType });
            return { error: null };
          },
          remove: async () => ({ error: null }),
          list: async () => ({ data: [], error: null }),
        }),
      },
      from: () => ({
        insert: async (row: Record<string, unknown>) => {
          records.push(row);
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;
    return { admin, uploads, records };
  };
  const brandId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";

  it("stores CSV text as a chart file in the brand's folder, judged by its bytes", async () => {
    const { admin, uploads, records } = recording();
    const file = await storeChartFile({ admin, brandId, userId, bytes: new TextEncoder().encode("Point,S\nChest,50\n") });
    expect(file).toMatchObject({ brandId, contentType: "text/csv" });
    expect(uploads).toEqual([{ path: `${brandId}/chart/${file.id}.csv`, type: "text/csv" }]);
    expect(records[0]).toMatchObject({ kind: "chart", width: null, height: null, created_by: userId });
  });

  it("refuses a file that is not a chart, and stores nothing", async () => {
    const { admin, uploads } = recording();
    const failure = await storeChartFile({ admin, brandId, userId, bytes: await png() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect(uploads).toEqual([]);
  });
});

describe("storeImage, for a generated picture", () => {
  it("keeps it in the images bucket, apart from uploads, under the brand's folder", async () => {
    const buckets: string[] = [];
    const rows: Record<string, unknown>[] = [];
    const admin = {
      rpc: noneUsed,
      storage: {
        from: (bucket: string) => {
          buckets.push(bucket);
          return { upload: async () => ({ error: null }), list: async () => ({ data: [], error: null }) };
        },
      },
      from: () => ({
        insert: async (row: Record<string, unknown>) => {
          rows.push(row);
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    const stored = await storeImage({ ...(await input(admin)), kind: "render" });

    expect([...new Set(buckets)]).toEqual(["images"]);
    expect(rows[0]).toMatchObject({ bucket: "images", kind: "render" });
    expect(String(rows[0].path)).toMatch(/^11111111-1111-4111-8111-111111111111\/render\//);
    expect(stored.kind).toBe("render");
  });
});

describe("the storage quota (security finding S-01)", () => {
  const standIn = (used: number, insertError: { code: string; message: string } | null = null) => {
    const uploads: string[] = [];
    const remove = vi.fn(async () => ({ error: null }));
    const admin = {
      rpc: async (fn: string) => ({ data: fn === "brand_storage_used" ? used : null, error: null }),
      storage: {
        from: () => ({
          upload: async (path: string) => {
            uploads.push(path);
            return { error: null };
          },
          remove,
          list: async () => ({ data: [], error: null }),
        }),
      },
      from: () => ({ insert: async () => ({ error: insertError }) }),
    } as unknown as SupabaseClient;
    return { admin, uploads, remove };
  };

  it("refuses an upload that would pass 500 MB before anything is sent to storage", async () => {
    const { admin, uploads } = standIn(BRAND_STORAGE_QUOTA_BYTES);
    const failure = await storeImage(await input(admin)).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ code: "over_quota", message: STORAGE_FULL_MESSAGE });
    expect(uploads).toEqual([]);
  });

  it("counts clean pictures and videos under _private/<brand>/ toward the quota", async () => {
    const { admin, uploads } = standIn(0);
    const sets = [{ name: "set-1", id: null }];
    const files = [{ name: "clip.mp4", id: "f1", metadata: { size: BRAND_STORAGE_QUOTA_BYTES } }];
    const lists: string[] = [];
    (admin as unknown as { storage: unknown }).storage = {
      from: () => ({
        upload: async (path: string) => (uploads.push(path), { error: null }),
        list: async (prefix: string) => (lists.push(prefix), { data: prefix.endsWith("set-1") ? files : sets, error: null }),
      }),
    };
    const failure = await storeImage(await input(admin)).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "over_quota" });
    expect(lists[0]).toBe("_private/11111111-1111-4111-8111-111111111111");
    expect(uploads).toEqual([]);
  });

  it("refuses a chart file the same way", async () => {
    const { admin, uploads } = standIn(BRAND_STORAGE_QUOTA_BYTES - 3);
    const failure = await storeChartFile({
      admin,
      brandId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      bytes: new TextEncoder().encode("Point,S\nChest,50\n"),
    }).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "over_quota" });
    expect(uploads).toEqual([]);
  });

  it("removes the file and gives the same reason when the database refuses it (a parallel upload won)", async () => {
    const { admin, uploads, remove } = standIn(0, { code: QUOTA_ERROR_CODE, message: "The brand's storage quota is used up." });
    const failure = await storeImage(await input(admin)).catch((error: unknown) => error);
    expect(uploads).toHaveLength(1);
    expect(remove).toHaveBeenCalledOnce();
    expect(failure).toMatchObject({ code: "over_quota", message: STORAGE_FULL_MESSAGE });
  });

  it("stores nothing when the brand's storage cannot be measured", async () => {
    const uploads: string[] = [];
    const admin = {
      rpc: async () => ({ data: null, error: { message: "down" } }),
      storage: { from: () => ({ upload: async (path: string) => (uploads.push(path), { error: null }) }) },
      from: () => ({ insert: async () => ({ error: null }) }),
    } as unknown as SupabaseClient;
    await expect(storeImage(await input(admin))).rejects.toThrow("The brand's storage could not be measured.");
    expect(uploads).toEqual([]);
  });
});
