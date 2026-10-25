import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { MAX_CLIP_BYTES, MEDIA_SET_RESERVE_BYTES } from "@/lib/media/video/limits";
import { privateMediaBytes } from "./private-usage";

const BRAND = "11111111-1111-4111-8111-111111111111";

const listing = (tree: Record<string, { name: string; id: string | null; metadata?: { size: number } }[]>, fail = false) =>
  ({ storage: { from: () => ({ list: async (prefix: string) => (fail ? { data: null, error: { message: "x" } } : { data: tree[prefix] ?? [], error: null }) }) } }) as unknown as SupabaseClient;

describe("privateMediaBytes", () => {
  it("adds up every file under the brand's private folder, however many sets", async () => {
    const admin = listing({
      [`_private/${BRAND}`]: [{ name: "s1", id: null }, { name: "s2", id: null }],
      [`_private/${BRAND}/s1`]: [{ name: "a.png", id: "1", metadata: { size: 100 } }, { name: "t.mp4", id: "2", metadata: { size: 900 } }],
      [`_private/${BRAND}/s2`]: [{ name: "c.mp4", id: "3", metadata: { size: 5 } }],
    });
    expect(await privateMediaBytes(admin, BRAND)).toBe(1005);
  });

  it("is zero for a brand with none, and throws when it cannot measure", async () => {
    expect(await privateMediaBytes(listing({}), BRAND)).toBe(0);
    await expect(privateMediaBytes(listing({}, true), BRAND)).rejects.toThrow("could not be measured");
  });
});

describe("what the media routes reserve", () => {
  it("is a real size, not one byte", () => {
    expect(MEDIA_SET_RESERVE_BYTES).toBeGreaterThan(1024 * 1024);
    expect(MAX_CLIP_BYTES).toBeGreaterThan(1024 * 1024);
  });
});
