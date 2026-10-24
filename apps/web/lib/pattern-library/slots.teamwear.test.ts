import { describe, expect, it } from "vitest";
import { TEAMWEAR_TYPE_IDS } from "@/lib/garment";
import { describeSlots, NO_PATTERN_TEXT, NO_PROGRAMME_TEXT, SLOTS } from "./slots";

describe("the slots for teamwear", () => {
  it("has one slot for every article, named as the article is", () => {
    for (const id of TEAMWEAR_TYPE_IDS) expect(SLOTS.map((slot) => slot.productKey)).toContain(id);
    expect(SLOTS.find((slot) => slot.productKey === "goalkeeper-shirt")?.label).toBe("Goalkeeper shirt");
  });

  it("says there is no pattern yet, never a made up one, until a technician or the owner supplies it", () => {
    const states = describeSlots([]);
    for (const id of TEAMWEAR_TYPE_IDS.filter((entry) => entry !== "football-socks")) {
      expect(states.find((state) => state.slot.productKey === id), id).toMatchObject({ blocks: [], emptyText: NO_PATTERN_TEXT });
    }
  });

  it("treats the football socks as a knitting programme, as socks always are", () => {
    expect(describeSlots([]).find((state) => state.slot.productKey === "football-socks")).toMatchObject({
      slot: { kind: "knit-programme", needsDraft: false },
      emptyText: NO_PROGRAMME_TEXT,
    });
  });
});
