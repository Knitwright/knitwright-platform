import { describe, expect, it } from "vitest";
import { fakeClient } from "./fixtures/fake-client";
import { BUCKETS, REMOVE_BATCH, emptyBrandFolders, removeObjects } from "./storage";

const BRAND = "0b5c7f0e-8a53-4a6f-9d3e-2f7f1c1f0a11";
const OTHER = "9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d";

describe("removeObjects", () => {
  it("removes each bucket's objects with one call per bucket", async () => {
    const fake = fakeClient({
      objects: { uploads: [`${BRAND}/artwork/a.png`, `${BRAND}/artwork/b.png`], images: [`${BRAND}/render/c.png`] },
    });

    await removeObjects(fake.client, [
      { bucket: "uploads", path: `${BRAND}/artwork/a.png` },
      { bucket: "images", path: `${BRAND}/render/c.png` },
      { bucket: "uploads", path: `${BRAND}/artwork/b.png` },
    ]);

    expect(fake.calls).toEqual([
      { kind: "remove", bucket: "uploads", paths: [`${BRAND}/artwork/a.png`, `${BRAND}/artwork/b.png`] },
      { kind: "remove", bucket: "images", paths: [`${BRAND}/render/c.png`] },
    ]);
    expect(fake.objects("uploads")).toEqual([]);
    expect(fake.objects("images")).toEqual([]);
  });

  it("makes no call when there is nothing to remove", async () => {
    const fake = fakeClient();
    await removeObjects(fake.client, []);
    expect(fake.calls).toEqual([]);
  });

  it("removes in batches, so one call never carries too many paths", async () => {
    const paths = Array.from({ length: REMOVE_BATCH + 3 }, (_, index) => `${BRAND}/artwork/${index}.png`);
    const fake = fakeClient({ objects: { uploads: paths } });

    await removeObjects(fake.client, paths.map((path) => ({ bucket: "uploads", path })));

    const sizes = fake.calls.map((call) => (call.kind === "remove" ? call.paths.length : 0));
    expect(sizes).toEqual([REMOVE_BATCH, 3]);
    expect(fake.objects("uploads")).toEqual([]);
  });

  it("throws when storage refuses, so the deletion stops before the rows go", async () => {
    const fake = fakeClient({ failRemove: ["uploads"] });
    await expect(
      removeObjects(fake.client, [{ bucket: "uploads", path: `${BRAND}/artwork/a.png` }]),
    ).rejects.toThrow("The stored files could not be removed.");
  });
});

describe("emptyBrandFolders", () => {
  it("removes everything under each brand's folder in every bucket, and nothing of another brand", async () => {
    const fake = fakeClient({
      objects: {
        uploads: [`${BRAND}/artwork/a.png`, `${BRAND}/sketch/b.jpg`, `${OTHER}/artwork/z.png`],
        images: [`${BRAND}/render/c.png`],
        exports: [],
      },
    });

    const removed = await emptyBrandFolders(fake.client, [BRAND]);

    expect(removed).toBe(3);
    expect(fake.objects("uploads")).toEqual([`${OTHER}/artwork/z.png`]);
    expect(fake.objects("images")).toEqual([]);
  });

  it("looks in every bucket that holds brand files", () => {
    expect(BUCKETS).toEqual(["uploads", "images", "exports"]);
  });

  it("reads a long folder a page at a time", async () => {
    const paths = Array.from({ length: 1005 }, (_, index) => `${BRAND}/artwork/${String(index).padStart(4, "0")}.png`);
    const fake = fakeClient({ objects: { uploads: paths } });

    expect(await emptyBrandFolders(fake.client, [BRAND])).toBe(1005);
    const offsets = fake.calls
      .filter((call) => call.kind === "list" && call.bucket === "uploads" && call.prefix === `${BRAND}/artwork`)
      .map((call) => (call.kind === "list" ? call.offset : -1));
    expect(offsets).toEqual([0, 1000]);
    expect(fake.objects("uploads")).toEqual([]);
  });

  it("refuses a brand id that is not an id, so no listing can reach outside one folder", async () => {
    const fake = fakeClient();
    await expect(emptyBrandFolders(fake.client, [""])).rejects.toThrow("not a brand id");
    await expect(emptyBrandFolders(fake.client, ["../x"])).rejects.toThrow("not a brand id");
    expect(fake.calls).toEqual([]);
  });

  it("throws when a folder cannot be listed", async () => {
    const fake = fakeClient({ failList: ["images"] });
    await expect(emptyBrandFolders(fake.client, [BRAND])).rejects.toThrow(
      "The stored files could not be listed.",
    );
  });
});
