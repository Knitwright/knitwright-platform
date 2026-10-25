import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { videoFiles } from "./files";

const BRAND = "11111111-1111-4111-8111-111111111111";

const client = (over: Record<string, unknown> = {}) => {
  const bucket = {
    upload: vi.fn(async () => ({ error: null })),
    download: vi.fn(async () => ({ error: null, data: new Blob([new Uint8Array([1, 2, 3])]) })),
    remove: vi.fn(async () => ({ error: null })),
    ...over,
  };
  return { bucket, admin: { storage: { from: () => bucket } } as unknown as SupabaseClient };
};

describe("videoFiles", () => {
  it("writes, reads and removes only inside the brand's private folder", async () => {
    const { bucket, admin } = client();
    const files = videoFiles(admin, BRAND);
    const path = `_private/${BRAND}/s/clip-scene.video`;
    await files.save(path, new Uint8Array([1]), "video/webm");
    expect(bucket.upload).toHaveBeenCalledWith(path, expect.anything(), { contentType: "video/webm", upsert: true });
    expect(await files.read(path)).toEqual(new Uint8Array([1, 2, 3]));
    await files.remove([path, `_private/other/x.video`, `${BRAND}/x`]);
    expect(bucket.remove).toHaveBeenCalledWith([path]);
    await files.remove([`_private/other/x.video`]);
    expect(bucket.remove).toHaveBeenCalledTimes(1);
  });
  it("refuses a path outside the folder and answers null for a missing file", async () => {
    const { admin, bucket } = client({ download: async () => ({ error: { message: "x" }, data: null }) });
    const files = videoFiles(admin, BRAND);
    await expect(files.save("_private/other/a.video", new Uint8Array(), "video/webm")).rejects.toThrow();
    expect(await files.read("_private/other/a.video")).toBeNull();
    expect(await files.read(`_private/${BRAND}/a.video`)).toBeNull();
    expect(bucket.upload).not.toHaveBeenCalled();
  });
  it("fails when storage refuses the write", async () => {
    const { admin } = client({ upload: async () => ({ error: { message: "full" } }) });
    await expect(videoFiles(admin, BRAND).save(`_private/${BRAND}/a.video`, new Uint8Array(), "video/webm")).rejects.toThrow("could not be stored");
  });
});
