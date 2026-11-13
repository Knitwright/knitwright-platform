import { describe, expect, it } from "vitest";
import { TECH_PACK_PAGES } from "@/lib/techpack/exports/pages";
import { madeUpOrderBoards } from "./fixtures";
import { FACTORY_DESK, PRESENTATION_LATER, PUBLISH_LATER } from "./share";
import { orderSummary, techPackLine, techPackSummary, THUMBNAIL_PAGES, trackSteps, type OrderInput } from "./summary";
import { NO_ORDER_BOARDS } from "./types";

const D = "00000000-0000-4000-8000-0000000000d1";

const tech = (needs: number) =>
  techPackSummary({
    designProjectId: D,
    designName: "Home kit",
    version: 3,
    pages: TECH_PACK_PAGES,
    counts: { from_base: 10, from_design: 5, needs_input: needs, confirmed: 0 },
    review: { exportBlocked: needs > 0, summary: "s" },
  });

describe("a tech pack board's summary", () => {
  it("is the sixteen pages, eight of them drawn, and the fields that wait", () => {
    const summary = tech(2);
    expect(summary.pages).toBe(16);
    expect(summary.thumbnails.map((page) => page.number)).toEqual(THUMBNAIL_PAGES);
    expect(summary.thumbnails[0]).toEqual({ number: 1, title: "Overview" });
    expect(summary).toMatchObject({ needsInput: 2, fromBase: 10, fromDesign: 5, exportBlocked: true, reviewNote: "s", version: 3 });
  });

  it("says what waits in one line", () => {
    expect(techPackLine(tech(0))).toBe("16 pages · nothing waits for input");
    expect(techPackLine(tech(1))).toBe("16 pages · 1 field needs input");
    expect(techPackLine(tech(4))).toBe("16 pages · 4 fields need input");
  });

  it("keeps a page's own title when it has no short one", () => {
    const summary = techPackSummary({ ...tech(0), pages: [{ number: 2, title: "Technical flats" }, { number: 99, title: "Other" }], counts: { from_base: 0, from_design: 0, needs_input: 0, confirmed: 0 }, review: { exportBlocked: false, summary: "" } } as never);
    expect(summary.thumbnails).toEqual([{ number: 2, title: "Flats" }]);
  });
});

const order = (over: Partial<OrderInput> = {}): OrderInput => ({
  id: "3f9a21c0-1111-4000-8000-000000000001",
  kind: "sample",
  sizes: { XL: 1, S: 1, M: 1 },
  pieces: 3,
  value: { minor: 11_700, currency: "GBP" },
  status: "in_production",
  readyOn: "2026-11-18",
  createdAt: "2026-11-04T09:00:00Z",
  ...over,
});

describe("an order board's summary", () => {
  it("is the newest order: what, how many, the price, the date, and where it is", () => {
    const summary = orderSummary([order({ id: "00000000-0000-4000-8000-000000000002", createdAt: "2026-10-01T00:00:00Z", kind: "run" }), order()]);
    expect(summary).toMatchObject({
      number: "KW-3F9A21C0",
      title: "Sample order",
      line: "3 pieces · £117.00 · ready 18 Nov",
      sizes: "S1 · M1 · XL1",
      status: "In production",
      tone: "warn",
      trackingHref: "/orders/3f9a21c0-1111-4000-8000-000000000001",
    });
    expect(summary?.steps.map((step) => step.state)).toEqual(["done", "done", "done", "current", "todo", "todo", "todo"]);
  });

  it("says what is not known rather than guessing it", () => {
    expect(orderSummary([order({ pieces: 1, value: null, readyOn: null, kind: "order" })])).toMatchObject({
      title: "Order",
      line: "1 piece · price on the invoice · ready date not set",
    });
  });

  it("breaks a tie by id, and is none with no order", () => {
    const a = order({ id: "00000000-0000-4000-8000-00000000000a", kind: "run" });
    const b = order({ id: "00000000-0000-4000-8000-00000000000b" });
    expect(orderSummary([a, b])?.title).toBe("Sample order");
    expect(orderSummary([])).toBeNull();
  });

  it("puts an order on hold at the first step", () => {
    expect(trackSteps("on_hold")[0]).toEqual({ id: "placed", label: "Placed", state: "current" });
  });
});

describe("the made-up data and the words", () => {
  it("fills both boards for the fixture", () => {
    const data = madeUpOrderBoards(D);
    expect(data.techPacks[D]?.needsInput).toBe(1);
    expect(data.orders[D]?.status).toBe("In production");
    expect(NO_ORDER_BOARDS).toEqual({ brandName: "", canOrder: false, techPacks: {}, orders: {} });
  });

  it("never promises the factory desk more than the tech pack, and says what is not built", () => {
    expect(FACTORY_DESK.access).toBe("Tech pack only");
    expect(PRESENTATION_LATER).toMatch(/not built yet/);
    expect(PUBLISH_LATER).toMatch(/not built yet/);
  });
});
