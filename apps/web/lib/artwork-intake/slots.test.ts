import { describe, expect, it } from "vitest";
import { REFUSALS } from "./messages";
import { slotsInUse, withSlot } from "./slots";

const gate = () => {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => (open = resolve));
  return { open, wait };
};

describe("withSlot", () => {
  it("lets a brand read a few files at once and turns away the next in plain words", async () => {
    const hold = gate();
    const first = withSlot("brand-a", () => hold.wait, 2);
    const second = withSlot("brand-a", () => hold.wait, 2);
    await expect(withSlot("brand-a", async () => 1, 2)).rejects.toMatchObject({ code: "rate_limited", message: REFUSALS.busy });
    expect(await withSlot("brand-b", async () => "other brand", 2)).toBe("other brand");
    hold.open();
    await Promise.all([first, second]);
    expect(slotsInUse("brand-a")).toBe(0);
  });

  it("gives the place back when the work fails", async () => {
    await expect(withSlot("brand-c", async () => Promise.reject(new Error("boom")), 1)).rejects.toThrow("boom");
    expect(await withSlot("brand-c", async () => "again", 1)).toBe("again");
  });
});
