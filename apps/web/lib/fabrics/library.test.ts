import { describe, expect, it } from "vitest";
import { fakeDb } from "./fixtures/fake-db";
import { loadFabricLibrary } from "./library";
import { saveSizeMap } from "./service";

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };

describe("loadFabricLibrary", () => {
  it("seeds the benchmark fabrics on first open and shows the suggested size map", async () => {
    const db = fakeDb();
    const lib = await loadFabricLibrary(db.client, db.client, who);
    expect(lib.fabrics.map((f) => f.name)).toEqual(["Polyester 1x1 rib", "Polyester birdseye mesh", "Recycled polyester interlock"]);
    expect(lib.fabrics.every((f) => f.printScale.startsWith("Not scaled for shrink"))).toBe(true);
    expect(lib.sizeMaps).toHaveLength(20);
    expect(lib.sizeMaps.every((m) => m.source === "suggested")).toBe(true);
    expect(lib.sizeMapReadiness).toMatchObject({ met: false, whoActs: "owner" });
  });

  it("does not seed twice", async () => {
    const db = fakeDb();
    await loadFabricLibrary(db.client, db.client, who);
    const again = await loadFabricLibrary(db.client, db.client, who);
    expect(again.fabrics).toHaveLength(3);
  });

  it("counts a brand's own choice as no longer suggested", async () => {
    const db = fakeDb();
    await saveSizeMap(db.client, who, { label: "M", wearer: "men", cut: "mens", patternSize: "50", source: "user-edited" });
    const lib = await loadFabricLibrary(db.client, db.client, who);
    expect(lib.sizeMaps.filter((m) => m.source !== "suggested")).toHaveLength(1);
    expect(lib.sizeMapReadiness.sentence).toMatch(/^19 size labels/);
  });
});
