import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { TOO_LARGE, createFileReader } from "./read";

const BRAND = "11111111-1111-4111-8111-111111111111";
const FILE = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

function clientWith(options: { row?: unknown; rowError?: unknown; download?: () => Promise<{ data: Blob | null; error: unknown }> }) {
  const filters: [string, unknown][] = [];
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    },
    maybeSingle: async () => ({ data: options.row ?? null, error: options.rowError ?? null }),
  };
  const download = vi.fn(options.download ?? (async () => ({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null })));
  const client = { from: () => query, storage: { from: () => ({ download }) } } as unknown as SupabaseClient;
  return { client, filters, download };
}

const ROW = { bucket: "uploads", path: `${BRAND}/artwork/${FILE}.png`, content_type: "image/png", bytes: 1000 };

describe("createFileReader", () => {
  it("reads the bytes of a file of this brand only", async () => {
    const { client, filters, download } = clientWith({ row: ROW });
    const found = await createFileReader(client, BRAND).read(FILE, 5000);
    expect(found).toEqual({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" });
    expect(filters).toEqual([["id", FILE], ["brand_id", BRAND]]);
    expect(download).toHaveBeenCalledWith(ROW.path);
  });

  it("finds nothing for an id that is not an id, a file that is not there, or another brand's file", async () => {
    expect(await createFileReader(clientWith({ row: ROW }).client, BRAND).read("not-a-uuid", 5000)).toBeNull();
    expect(await createFileReader(clientWith({}).client, BRAND).read(FILE, 5000)).toBeNull();
  });

  it("finds nothing when the record or the download fails, and does not throw", async () => {
    expect(await createFileReader(clientWith({ rowError: { message: "x" } }).client, BRAND).read(FILE, 5000)).toBeNull();
    const failing = clientWith({ row: ROW, download: async () => ({ data: null, error: { message: "gone" } }) });
    expect(await createFileReader(failing.client, BRAND).read(FILE, 5000)).toBeNull();
  });

  it("finds nothing for a record that does not look right", async () => {
    expect(await createFileReader(clientWith({ row: { bucket: 1 } }).client, BRAND).read(FILE, 5000)).toBeNull();
  });

  it("does not download a file whose recorded size is over the limit", async () => {
    const { client, download } = clientWith({ row: ROW });
    expect(await createFileReader(client, BRAND).read(FILE, 999)).toBe(TOO_LARGE);
    expect(download).not.toHaveBeenCalled();
    expect(await createFileReader(client, BRAND).read(FILE, 1000)).not.toBe(TOO_LARGE);
  });

  it("does not trust the recorded size: bytes that turn out larger are refused too", async () => {
    const big = clientWith({ row: ROW, download: async () => ({ data: new Blob([new Uint8Array(3000)]), error: null }) });
    expect(await createFileReader(big.client, BRAND).read(FILE, 2000)).toBe(TOO_LARGE);
  });
});
