import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Layer } from "@/lib/artwork-stack";

const uploads: string[] = [];
const deletes: string[] = [];
vi.mock("@/lib/artwork-intake", () => ({
  uploadArtwork: vi.fn(async (_admin: unknown, _who: unknown, input: { fileName: string; rightsConfirmed: boolean }) => {
    uploads.push(`${input.fileName}:${input.rightsConfirmed}`);
    return { id: `eeeeeeee-0000-4000-8000-${String(uploads.length).padStart(12, "0")}` };
  }),
  deleteArtwork: vi.fn(async (_admin: unknown, _brand: string, id: string) => {
    deletes.push(id);
    if (id.endsWith("9")) throw new Error("gone already");
  }),
}));

const { createDerivedStore, derivedAssetOf, derivedIds } = await import("./derived");

const admin = {} as SupabaseClient;
const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const base = { opacity: 1, blend: "normal" as const, views: ["front" as const] };
const UUID = "eeeeeeee-0000-4000-8000-000000000001";
const fill = (over: object): Layer => ({ ...base, id: "f", kind: "image-fill", provenance: "read-from-image", assetId: UUID, mode: "tile", scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, halfDrop: false, fit: "cover", ...over }) as Layer;
const crest = (over: object): Layer => ({ ...base, id: "g", kind: "graphic", provenance: "read-from-image", source: { kind: "asset", assetId: UUID }, placement: { kind: "anchor", anchorId: "hps" }, offsetMm: { x: 0, y: 0 }, widthMm: 10, rotationDeg: 0, clearSpaceMm: 0, knockOut: false, ...over }) as Layer;

describe("the store of cut pictures", () => {
  it("stores a picture through W7b with the rights the person ticked, and removes without ever throwing", async () => {
    const store = createDerivedStore(admin, who, new Date("2026-10-15T00:00:00Z"));
    expect(await store.add(new Uint8Array([1]), "design-tile-front.png")).toMatch(/^eeeeeeee/);
    expect(uploads).toEqual(["design-tile-front.png:true"]);
    await store.remove(["eeeeeeee-0000-4000-8000-000000000001", "eeeeeeee-0000-4000-8000-000000000009"]);
    expect(deletes).toHaveLength(2);
  });
});

describe("derivedAssetOf", () => {
  it("names the artwork cut for a layer, and nothing for a stand-in, the person's own file, or another kind of layer", () => {
    expect(derivedAssetOf(fill({}))).toBe(UUID);
    expect(derivedAssetOf(crest({}))).toBe(UUID);
    expect(derivedAssetOf(fill({ assetId: "tile-front" }))).toBeNull();
    expect(derivedAssetOf(crest({ provenance: "user-edited" }))).toBeNull();
    expect(derivedAssetOf(crest({ source: { kind: "file", fileId: "ffffffff-0000-4000-8000-000000000001" } }))).toBeNull();
    expect(derivedAssetOf({ ...base, id: "t", kind: "ground", provenance: "read-from-image", colourId: "c" } as Layer)).toBeNull();
    expect(derivedIds([fill({}), crest({ provenance: "user-edited" })])).toEqual([UUID]);
  });
});
