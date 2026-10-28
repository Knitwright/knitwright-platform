import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { PRODUCTION_KINDS, storeProductionFile } from "./store";

const brandId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const recording = () => {
  const uploads: { bucket: string; path: string; type: string }[] = [];
  const records: Record<string, unknown>[] = [];
  const admin = {
    rpc: async () => ({ data: 0, error: null }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _bytes: Uint8Array, options: { contentType: string }) => {
          uploads.push({ bucket, path, type: options.contentType });
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

const text = (value: string) => new TextEncoder().encode(value);
const SVG = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm"></svg>';
const refuses = async (promise: Promise<unknown>) => expect(await promise.catch((e: unknown) => e)).toBeInstanceOf(AppError);

describe("storeProductionFile", () => {
  it("names the four new kinds", () => {
    expect([...PRODUCTION_KINDS]).toEqual(["print", "proof", "roster", "pattern-source"]);
  });

  it("stores a print PDF and TIFF with the exports, in the brand's folder under the kind", async () => {
    const tiff = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).tiff().toBuffer();
    const files = [
      { contentType: "application/pdf", bytes: text("%PDF-1.7\n"), ext: "pdf" },
      { contentType: "image/tiff", bytes: tiff, ext: "tiff" },
    ];
    for (const file of files) {
      const { admin, uploads, records } = recording();
      const stored = await storeProductionFile("print", { admin, brandId, userId, bytes: file.bytes, contentType: file.contentType });
      expect(uploads).toEqual([{ bucket: "exports", path: `${brandId}/print/${stored.id}.${file.ext}`, type: file.contentType }]);
      expect(records[0]).toMatchObject({ kind: "print", bucket: "exports", content_type: file.contentType, created_by: userId });
    }
  });

  it("stores a roster as CSV text and a source pattern as DXF", async () => {
    const roster = recording();
    await storeProductionFile("roster", { ...roster, brandId, userId, bytes: text("name,number\nOKAFOR,7\n"), contentType: "text/csv" });
    expect(roster.records[0]).toMatchObject({ kind: "roster", bucket: "exports" });

    const dxf = recording();
    await storeProductionFile("pattern-source", { ...dxf, brandId, userId, bytes: text("0\nSECTION\n2\nHEADER\n"), contentType: "application/dxf" });
    expect(dxf.records[0]).toMatchObject({ kind: "pattern-source", bucket: "exports" });
  });

  it("checks and rewrites a proof photo, and keeps it with the uploads", async () => {
    const { admin, uploads, records } = recording();
    const photo = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#2b46f0" } }).png().toBuffer();
    const stored = await storeProductionFile("proof", { admin, brandId, userId, bytes: photo });
    expect(stored.contentType).toBe("image/png");
    expect(uploads[0]).toMatchObject({ bucket: "uploads", type: "image/png" });
    expect(records[0]).toMatchObject({ kind: "proof", width: 8, height: 8 });
    await refuses(storeProductionFile("proof", { admin, brandId, userId, bytes: text(SVG) }));
  });

  it("refuses a type the kind does not allow, and bytes that are not what they say", async () => {
    const { admin, uploads } = recording();
    const base = { admin, brandId, userId };
    await refuses(storeProductionFile("print", { ...base, bytes: text("a,b"), contentType: "text/csv" }));
    await refuses(storeProductionFile("print", { ...base, bytes: text("%PDF-1.7"), contentType: undefined }));
    await refuses(storeProductionFile("print", { ...base, bytes: text("not a pdf"), contentType: "application/pdf" }));
    await refuses(storeProductionFile("print", { ...base, bytes: text("not a tiff"), contentType: "image/tiff" }));
    await refuses(storeProductionFile("print", { ...base, bytes: new Uint8Array(0), contentType: "application/pdf" }));
    await refuses(storeProductionFile("roster", { ...base, bytes: new Uint8Array([0x61, 0, 0x62]), contentType: "text/csv" }));
    await refuses(storeProductionFile("roster", { ...base, bytes: new Uint8Array([0xff, 0xfe, 0xfd]), contentType: "text/csv" }));
    await refuses(storeProductionFile("pattern-source", { ...base, bytes: text("hello"), contentType: "application/dxf" }));
    expect(uploads).toEqual([]);
  });

  it("refuses an SVG for any kind, so a script never reaches the exports", async () => {
    const { admin, uploads } = recording();
    await refuses(storeProductionFile("print", { admin, brandId, userId, bytes: text(SVG), contentType: "image/svg+xml" }));
    expect(uploads).toEqual([]);
  });

  it("refuses a roster over its size limit", async () => {
    const { admin } = recording();
    await refuses(storeProductionFile("roster", { admin, brandId, userId, bytes: new Uint8Array(2 * 1024 * 1024 + 1).fill(97), contentType: "text/csv" }));
  });
});
