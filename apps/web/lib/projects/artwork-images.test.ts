import { describe, expect, it, vi } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import type { Artwork, GarmentSpec } from "@/lib/garment";
import { TOO_LARGE } from "@/lib/storage/read";
import {
  MAX_EMBEDDED_BYTES,
  MAX_PICTURES_DRAWN,
  MAX_PICTURE_BYTES,
  MAX_READS_AT_ONCE,
  loadArtworkImages,
  picturesNote,
} from "./artwork-images";

const idOf = (n: number): string => `6f0b1c1e-6a3b-4f6e-9f43-${String(n).padStart(12, "0")}`;
const A = idOf(1);
const B = idOf(2);

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

const file = (n: number): Artwork => art(`art-${n}`, { kind: "file", fileId: idOf(n) });
const withArt = (...items: Artwork[]): GarmentSpec => ({ ...start("crew-tee"), artwork: items });
const bytes = (n: number, size = 1) => new Uint8Array(size).fill(n);
const passThrough = async (stored: { bytes: Uint8Array }) => ({ bytes: stored.bytes, contentType: "image/png" as const });

describe("loadArtworkImages", () => {
  it("reads each picture once, shrinks it, and returns it by file id", async () => {
    const read = vi.fn(async (id: string) => ({ bytes: bytes(id === A ? 1 : 2), contentType: "image/png" }));
    const shrink = vi.fn(async (stored: { bytes: Uint8Array }) => ({ bytes: new Uint8Array([...stored.bytes, 9]), contentType: "image/png" as const }));
    const spec = withArt(art("one", { kind: "file", fileId: A }), art("two", { kind: "file", fileId: A }), art("three", { kind: "file", fileId: B }));
    const loaded = await loadArtworkImages({ read }, shrink, spec);
    expect(read).toHaveBeenCalledTimes(2);
    expect([...loaded.images.keys()].sort()).toEqual([A, B]);
    expect([...(loaded.images.get(A)?.bytes ?? [])]).toEqual([1, 9]);
    expect(loaded.skipped).toBe(0);
  });

  it("asks for nothing when the design has no pictures, and ignores text artwork", async () => {
    const read = vi.fn();
    expect((await loadArtworkImages({ read }, vi.fn(), withArt())).images.size).toBe(0);
    expect((await loadArtworkImages({ read }, vi.fn(), withArt(art("t", { kind: "text", text: "HI" })))).images.size).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });

  it("leaves out a picture that is missing, cannot be shrunk or cannot be read, without failing the rest", async () => {
    const read = vi.fn(async (id: string) => {
      if (id === B) throw new Error("storage down");
      return { bytes: bytes(1), contentType: "image/png" };
    });
    const shrink = vi.fn(async () => null);
    const spec = withArt(art("one", { kind: "file", fileId: A }), art("two", { kind: "file", fileId: B }));
    expect((await loadArtworkImages({ read }, shrink, spec)).images.size).toBe(0);
    const missing = vi.fn(async () => null);
    expect((await loadArtworkImages({ read: missing }, shrink, spec)).images.size).toBe(0);
  });
});

describe("the limits", () => {
  it("names them: 8 pictures, 3 reads at a time, a size for one picture and a size for the page", () => {
    expect(MAX_PICTURES_DRAWN).toBe(8);
    expect(MAX_READS_AT_ONCE).toBe(3);
    expect(MAX_PICTURE_BYTES).toBeGreaterThan(0);
    expect(MAX_EMBEDDED_BYTES).toBeGreaterThan(MAX_PICTURE_BYTES / 10);
  });

  it("draws at most 8 pictures, reads no more than that, and counts the rest as skipped", async () => {
    const read = vi.fn(async () => ({ bytes: bytes(1), contentType: "image/png" }));
    const spec = withArt(...Array.from({ length: 12 }, (_, index) => file(index + 1)));
    const loaded = await loadArtworkImages({ read }, passThrough, spec);
    expect(read).toHaveBeenCalledTimes(MAX_PICTURES_DRAWN);
    expect(loaded.images.size).toBe(MAX_PICTURES_DRAWN);
    expect(loaded.skipped).toBe(4);
  });

  it("never has more than 3 reads going at once", async () => {
    let running = 0;
    let most = 0;
    const read = vi.fn(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return { bytes: bytes(1), contentType: "image/png" };
    });
    await loadArtworkImages({ read }, passThrough, withArt(...Array.from({ length: 8 }, (_, index) => file(index + 1))));
    expect(most).toBe(MAX_READS_AT_ONCE);
  });

  it("asks the reader not to read a file whose recorded size is over the limit, and counts it as skipped", async () => {
    const read = vi.fn(async (id: string, maxBytes: number) => (id === A ? TOO_LARGE : { bytes: bytes(1), contentType: "image/png", maxBytes }));
    const spec = withArt(art("big", { kind: "file", fileId: A }), art("small", { kind: "file", fileId: B }));
    const loaded = await loadArtworkImages({ read }, passThrough, spec);
    expect(read).toHaveBeenCalledWith(A, MAX_PICTURE_BYTES);
    expect([...loaded.images.keys()]).toEqual([B]);
    expect(loaded.skipped).toBe(1);
  });

  it("stops adding pictures once the page would hold more than its share, and counts what is left", async () => {
    const half = Math.floor(MAX_EMBEDDED_BYTES / 2) + 1;
    const read = vi.fn(async () => ({ bytes: bytes(1, half), contentType: "image/png" }));
    const spec = withArt(file(1), file(2), file(3));
    const loaded = await loadArtworkImages({ read }, passThrough, spec);
    expect([...loaded.images.keys()]).toEqual([idOf(1)]);
    expect(loaded.skipped).toBe(2);
  });
});

describe("picturesNote", () => {
  it("says nothing when every picture is shown", () => {
    expect(picturesNote(0)).toBeNull();
  });

  it("says in one plain sentence that some are not shown, and why", () => {
    expect(picturesNote(1)).toBe("1 picture is not shown, because it is too big or there are too many, so a dashed box marks where it goes.");
    expect(picturesNote(3)).toBe("3 pictures are not shown, because they are too big or there are too many, so a dashed box marks where each one goes.");
  });
});
