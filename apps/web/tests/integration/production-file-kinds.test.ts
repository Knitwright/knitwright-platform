import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { PRODUCTION_KINDS, storeProductionFile, type ProductionKind } from "@/lib/storage/store";
import { adminClient, brandOf, person, type Person } from "./support";

/** Migration 20261015000100: the new file kinds and the exports bucket's new types. */

let alice: Person;
let brandId: string;

const text = (value: string) => new TextEncoder().encode(value);

const store = async (kind: ProductionKind, bytes: Uint8Array, contentType?: string) =>
  storeProductionFile(kind, { admin: adminClient(), brandId, userId: alice.userId, bytes, contentType });

beforeAll(async () => {
  alice = await person("alice");
  brandId = await brandOf(alice, "Alice Athletic");
});

describe("the production file kinds", () => {
  it("accepts a print PDF, an SVG and a TIFF in the exports bucket", async () => {
    const tiff = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).tiff().toBuffer();
    await store("print", text("%PDF-1.7\n"), "application/pdf");
    await store("print", text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), "image/svg+xml");
    await store("print", tiff, "image/tiff");
  });

  it("accepts a roster as CSV and a source pattern as DXF", async () => {
    await store("roster", text("name,number\nOKAFOR,7\n"), "text/csv");
    await store("pattern-source", text("0\nSECTION\n2\nHEADER\n"), "application/dxf");
  });

  it("accepts a proof photo with the uploads", async () => {
    const photo = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#2b46f0" } }).png().toBuffer();
    await store("proof", photo);
  });

  it("records each kind, so the database check allows it", async () => {
    const { data, error } = await adminClient().from("files").select("kind").eq("brand_id", brandId);
    expect(error).toBeNull();
    const kinds = new Set((data ?? []).map((row: { kind: string }) => row.kind));
    for (const kind of PRODUCTION_KINDS) expect(kinds.has(kind)).toBe(true);
  });

  it("still refuses a kind the check does not list", async () => {
    const { error } = await adminClient().from("files").insert({
      brand_id: brandId, bucket: "exports", path: `${brandId}/nope/x.pdf`, kind: "nope",
      content_type: "application/pdf", bytes: 1, created_by: alice.userId,
    });
    expect(error).not.toBeNull();
  });
});
