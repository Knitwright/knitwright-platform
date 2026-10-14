import { describe, expect, it } from "vitest";
import { LAUNCH_GARMENTS } from "@/lib/config/launch-garments";
import type { BlockView } from "./records";
import { ASK_TEXT, describeSlots, emptySlotText, NO_PATTERN_TEXT, NO_PROGRAMME_TEXT, SLOTS, slotFor } from "./slots";

const block = (patch: Partial<BlockView>): BlockView => ({
  id: "id", productKey: "crew-tee", wearer: "men", cut: "mens", name: "Crew tee", kind: "pieces", version: 1, source: "technician-upload",
  sources: "Uploaded by a technician", sizes: ["M"], derived: [], warnings: [], questions: [], sizeMap: null, programmeNote: null,
  createdAt: "2026-10-15T00:00:00Z", state: "draft", review: null, ...patch,
});

describe("the slots", () => {
  it("cover every garment on offer, the skort, the raglan jersey and socks", () => {
    const keys = SLOTS.map((s) => s.productKey);
    for (const id of LAUNCH_GARMENTS) expect(keys).toContain(id);
    expect(keys).toEqual(expect.arrayContaining(["skort", "raglan-jersey", "socks"]));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("say 'No pattern yet' for the products fashionINSTA cannot draft, and socks are a knit programme", () => {
    for (const key of ["shorts", "singlet", "skort", "pullover-hoodie", "zip-hoodie", "track-jacket", "raglan-jersey", "polo"]) {
      expect(slotFor(key)?.needsDraft).toBe(true);
      expect(emptySlotText(slotFor(key)!)).toBe(NO_PATTERN_TEXT);
    }
    expect(NO_PATTERN_TEXT).toBe("No pattern yet: needs a technician's draft or your DXF.");
    expect(slotFor("socks")).toMatchObject({ kind: "knit-programme", needsDraft: false });
    expect(emptySlotText(slotFor("socks")!)).toBe(NO_PROGRAMME_TEXT);
    expect(emptySlotText(slotFor("crew-tee")!)).toBe(ASK_TEXT);
    expect(slotFor("nothing")).toBeUndefined();
  });
});

describe("describeSlots", () => {
  it("files the newest block of each wearer and cut under its slot, and leaves other slots empty", () => {
    const states = describeSlots([
      block({ id: "old", version: 1 }), block({ id: "new", version: 2 }), block({ id: "women", wearer: "women", cut: "womens", version: 1 }),
      block({ id: "other", productKey: "polo" }),
    ]);
    const tee = states.find((s) => s.slot.productKey === "crew-tee");
    expect(tee?.blocks.map((b) => b.id)).toEqual(["new", "women"].sort((a, b) => (a === "new" ? -1 : 1)).sort((a, b) => ["men", "women"].indexOf(a === "new" ? "men" : "women") - ["men", "women"].indexOf(b === "new" ? "men" : "women")));
    expect(tee?.emptyText).toBeNull();
    expect(states.find((s) => s.slot.productKey === "polo")?.blocks).toHaveLength(1);
    expect(states.find((s) => s.slot.productKey === "shorts")).toMatchObject({ blocks: [], emptyText: NO_PATTERN_TEXT });
  });

  it("keeps the first of two blocks at the same version", () => {
    const states = describeSlots([block({ id: "a" }), block({ id: "b" })]);
    expect(states.find((s) => s.slot.productKey === "crew-tee")?.blocks.map((b) => b.id)).toEqual(["a"]);
  });
});
