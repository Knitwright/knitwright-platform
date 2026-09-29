import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { storeImage } from "./store";

const recordError = { message: "insert failed", code: "23503" };

// A hand-written stand-in: the real client cannot be made to fail in this order.
const adminWhere = (removal: () => Promise<unknown>) => {
  const remove = vi.fn(removal);
  const admin = {
    storage: {
      from: () => ({ upload: async () => ({ error: null }), remove }),
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
    storage: {
      from: () => ({
        upload: async (path: string, _bytes: Uint8Array, options: { contentType?: string }) => {
          uploads.push({ path, type: options.contentType });
          return { error: null };
        },
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

describe("storeImage, for a generated picture", () => {
  it("keeps it in the images bucket, apart from uploads, under the brand's folder", async () => {
    const buckets: string[] = [];
    const rows: Record<string, unknown>[] = [];
    const admin = {
      storage: {
        from: (bucket: string) => {
          buckets.push(bucket);
          return { upload: async () => ({ error: null }) };
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

    expect(buckets).toEqual(["images"]);
    expect(rows[0]).toMatchObject({ bucket: "images", kind: "render" });
    expect(String(rows[0].path)).toMatch(/^11111111-1111-4111-8111-111111111111\/render\//);
    expect(stored.kind).toBe("render");
  });
});
