import { describe, expect, it } from "vitest";
import { FLOW_ITEM, sampleListing } from "./fixtures/samples";
import { draftOf, liveView, majorText, makePrimary, previewOf, savedLine, toMinor, toggleMedia, withEveryPrice, withPrice, withTag, withoutTag } from "./editor-state";
import { RENDER_ITEM } from "./media";
import { shopOrderHeadline } from "./order-view";

const LISTING = sampleListing();
const DRAFT = draftOf(LISTING);

describe("the listing editor's state", () => {
  it("reads money as it is typed", () => {
    expect(toMinor("45")).toBe(4500);
    expect(toMinor("45.5")).toBe(4550);
    expect(toMinor("£1,045.00")).toBe(104500);
    expect(toMinor("A$12")).toBe(1200);
    expect(toMinor("4.555")).toBeNull();
    expect(toMinor("abc")).toBeNull();
    expect(majorText(4500)).toBe("45.00");
    expect(majorText(null)).toBe("");
  });

  it("sets and clears a size's price, or every size's", () => {
    expect(withPrice(DRAFT, "M", "50").prices.M).toBe(5000);
    expect(withPrice(DRAFT, "M", "").prices.M).toBeUndefined();
    expect(withPrice(DRAFT, "M", "0").prices.M).toBeUndefined();
    expect(withEveryPrice(DRAFT, ["S", "M"], "39")).toMatchObject({ prices: { S: 3900, M: 3900 } });
  });

  it("picks pictures, at most ten, and makes one the primary", () => {
    const none = { ...DRAFT, media: [] };
    const one = toggleMedia(none, RENDER_ITEM);
    expect(one.media).toEqual([RENDER_ITEM]);
    expect(toggleMedia(one, RENDER_ITEM).media).toEqual([]);
    const full = { ...DRAFT, media: Array.from({ length: 10 }, (_, i) => ({ ...FLOW_ITEM, id: `f${i}` })) };
    expect(toggleMedia(full, RENDER_ITEM).media).toHaveLength(10);
    expect(makePrimary(DRAFT, FLOW_ITEM.id).media[0]).toEqual(FLOW_ITEM);
    expect(makePrimary(DRAFT, "missing")).toBe(DRAFT);
  });

  it("adds tags by comma, without repeats, and removes them", () => {
    expect(withTag({ ...DRAFT, tags: ["kit"] }, "Kit, Lions , ").tags).toEqual(["kit", "lions"]);
    expect(withoutTag({ ...DRAFT, tags: ["kit", "lions"] }, "kit").tags).toEqual(["lions"]);
  });

  it("shows live price rows and health for what is typed", () => {
    const view = liveView(LISTING, withPrice(DRAFT, "S", "10"), ["S", "M"], { status: "priced", unitMinor: 1820, label: "" }, { stage: "run", hasRelease: true, productionClass: "A", euResponsiblePerson: null, storefrontLive: true });
    expect(view.rows[0]).toMatchObject({ retailMinor: 1000, profitMinor: -820 });
    expect(view.health.find((line) => line.id === "prices")?.state).toBe("block");
    expect(previewOf(LISTING, { ...DRAFT, title: "New" }).title).toBe("New");
  });

  it("says when it was last saved", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    expect(savedLine(null, now)).toBe("Not saved yet");
    expect(savedLine("2026-11-13T11:59:50Z", now)).toBe("Last saved just now");
    expect(savedLine("2026-11-13T11:58:00Z", now)).toBe("Last saved 2 minutes ago");
    expect(savedLine("2026-11-13T11:59:00Z", now)).toBe("Last saved 1 minute ago");
    expect(savedLine("2026-11-13T10:00:00Z", now)).toBe("Last saved 2 hours ago");
    expect(savedLine("2026-11-13T11:00:00Z", now)).toBe("Last saved 1 hour ago");
    expect(savedLine("2026-11-10T10:00:00Z", now)).toBe("Last saved 2026-11-10");
  });
});

describe("the shopper's order page", () => {
  it("says where the order stands", () => {
    expect(shopOrderHeadline({ status: "paid", cancelled: false, batched: false }).title).toBe("Thank you, your order is paid");
    expect(shopOrderHeadline({ status: "fulfilled", cancelled: false, batched: true }).title).toBe("In production");
    expect(shopOrderHeadline({ status: "refunded", cancelled: false, batched: true }).title).toBe("Refunded");
    expect(shopOrderHeadline({ status: "expired", cancelled: false, batched: false }).tone).toBe("warn");
    expect(shopOrderHeadline({ status: "open", cancelled: true, batched: false }).title).toBe("Not paid");
    expect(shopOrderHeadline({ status: "open", cancelled: false, batched: false })).toMatchObject({ waiting: true });
  });
});
