import { describe, expect, it, vi } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import type { Artwork, GarmentSpec } from "@/lib/garment";
import { loadArtworkImages } from "./artwork-images";

const A = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";
const B = "7f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b22";

const art = (id: string, source: Artwork["source"]): Artwork => ({
  id,
  name: id,
  source,
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 500,
  height: 500,
  rotationDegrees: 0,
  technique: "screen-print",
  provenance: "user-edited",
});

const withArt = (...items: Artwork[]): GarmentSpec => ({ ...start("crew-tee"), artwork: items });
const bytes = (n: number) => new Uint8Array([n]);

describe("loadArtworkImages", () => {
  it("reads each picture once, shrinks it, and returns it by file id", async () => {
    const read = vi.fn(async (id: string) => ({ bytes: bytes(id === A ? 1 : 2), contentType: "image/png" }));
    const shrink = vi.fn(async (file: { bytes: Uint8Array; contentType: string }) => ({ bytes: new Uint8Array([...file.bytes, 9]), contentType: "image/png" as const }));
    const spec = withArt(art("one", { kind: "file", fileId: A }), art("two", { kind: "file", fileId: A }), art("three", { kind: "file", fileId: B }));
    const images = await loadArtworkImages({ read }, shrink, spec);
    expect(read).toHaveBeenCalledTimes(2);
    expect([...images.keys()].sort()).toEqual([A, B]);
    expect([...(images.get(A)?.bytes ?? [])]).toEqual([1, 9]);
  });

  it("asks for nothing when the design has no pictures, and ignores text artwork", async () => {
    const read = vi.fn();
    expect((await loadArtworkImages({ read }, vi.fn(), withArt())).size).toBe(0);
    expect((await loadArtworkImages({ read }, vi.fn(), withArt(art("t", { kind: "text", text: "HI" })))).size).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });

  it("leaves out a picture that is missing, cannot be shrunk or cannot be read, without failing the rest", async () => {
    const read = vi.fn(async (id: string) => {
      if (id === B) throw new Error("storage down");
      return { bytes: bytes(1), contentType: "image/png" };
    });
    const shrink = vi.fn(async () => null);
    const spec = withArt(art("one", { kind: "file", fileId: A }), art("two", { kind: "file", fileId: B }));
    expect((await loadArtworkImages({ read }, shrink, spec)).size).toBe(0);
    const missing = vi.fn(async () => null);
    expect((await loadArtworkImages({ read: missing }, shrink, spec)).size).toBe(0);
  });
});
