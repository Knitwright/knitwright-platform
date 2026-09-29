import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { createFileReader } from "./read";
import { shrinkForDrawing, DRAWING_EDGE } from "./thumbnail";

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

const ROW = { bucket: "uploads", path: `${BRAND}/artwork/${FILE}.png`, content_type: "image/png" };

describe("createFileReader", () => {
  it("reads the bytes of a file of this brand only", async () => {
    const { client, filters, download } = clientWith({ row: ROW });
    const found = await createFileReader(client, BRAND).read(FILE);
    expect(found).toEqual({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" });
    expect(filters).toEqual([["id", FILE], ["brand_id", BRAND]]);
    expect(download).toHaveBeenCalledWith(ROW.path);
  });

  it("finds nothing for an id that is not an id, a file that is not there, or another brand's file", async () => {
    expect(await createFileReader(clientWith({ row: ROW }).client, BRAND).read("not-a-uuid")).toBeNull();
    expect(await createFileReader(clientWith({}).client, BRAND).read(FILE)).toBeNull();
  });

  it("finds nothing when the record or the download fails, and does not throw", async () => {
    expect(await createFileReader(clientWith({ rowError: { message: "x" } }).client, BRAND).read(FILE)).toBeNull();
    const failing = clientWith({ row: ROW, download: async () => ({ data: null, error: { message: "gone" } }) });
    expect(await createFileReader(failing.client, BRAND).read(FILE)).toBeNull();
  });

  it("finds nothing for a record that does not look right", async () => {
    expect(await createFileReader(clientWith({ row: { bucket: 1 } }).client, BRAND).read(FILE)).toBeNull();
  });
});

describe("shrinkForDrawing", () => {
  it("makes a large picture small enough to sit inside a page, keeping its shape and type", async () => {
    const big = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#cc3300" } }).png().toBuffer();
    const small = (await shrinkForDrawing({ bytes: new Uint8Array(big), contentType: "image/png" })) as NonNullable<Awaited<ReturnType<typeof shrinkForDrawing>>>;
    const meta = await sharp(small.bytes).metadata();
    expect(small.contentType).toBe("image/png");
    expect(meta.width).toBe(DRAWING_EDGE);
    expect(meta.height).toBe(DRAWING_EDGE / 2);
    expect(small.bytes.byteLength).toBeLessThan(big.byteLength);
  });

  it("does not make a small picture larger", async () => {
    const tiny = await sharp({ create: { width: 20, height: 10, channels: 3, background: "#00cc33" } }).jpeg().toBuffer();
    const result = (await shrinkForDrawing({ bytes: new Uint8Array(tiny), contentType: "image/jpeg" })) as NonNullable<Awaited<ReturnType<typeof shrinkForDrawing>>>;
    expect((await sharp(result.bytes).metadata()).width).toBe(20);
    expect(result.contentType).toBe("image/jpeg");
  });

  it("gives nothing back for bytes that are not a picture", async () => {
    expect(await shrinkForDrawing({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" })).toBeNull();
  });
});
