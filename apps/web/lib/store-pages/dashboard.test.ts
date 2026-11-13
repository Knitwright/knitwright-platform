import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accountView, balancesOf, dayLabel, mainCurrency, money, nextPayoutDate, overviewOf, PAYOUT_HOUR_UTC, PAYOUT_WEEKDAY, payableOf, saleState } from "./dashboard";
import { account, MONTH_OF_SALES, sale } from "./fixtures/store";

/**
 * Decision 0156 (F-L5, F-L7): only delivered, non-refunded margin is owed; a refund comes off the margin, never
 * below nothing; a refund after a payout is taken off the next one. And the page's words for each state.
 */

const NOW = new Date("2026-11-13T12:00:00.000Z"); // a Friday, after the run

describe("what a sale may pay", () => {
  it("is its margin less refunds, never below nothing", () => {
    expect(payableOf({ marginMinor: 1500, refundedMinor: 0 })).toBe(1500);
    expect(payableOf({ marginMinor: 1500, refundedMinor: 500 })).toBe(1000);
    expect(payableOf({ marginMinor: 1500, refundedMinor: 4500 })).toBe(0);
  });
});

describe("balancesOf", () => {
  it("owes delivered margin not yet paid and holds undelivered margin", () => {
    const [gbp] = balancesOf(MONTH_OF_SALES, new Map());
    expect(gbp).toEqual({ currency: "GBP", owedMinor: 2956 + 1700, heldMinor: 1500, undelivered: 1 });
  });

  it("takes off what payouts paid, and goes below nothing when a refund came after a payout", () => {
    const paid = new Map([["00000000-0000-4000-8000-000000000011", 2956], ["00000000-0000-4000-8000-000000000014", 1478]]);
    const [gbp] = balancesOf(MONTH_OF_SALES, paid);
    expect(gbp?.owedMinor).toBe(1700 - 1478);
  });

  it("keeps currencies apart, GBP first", () => {
    const balances = balancesOf([sale({ currency: "AUD", deliveredAt: NOW.toISOString() }), sale({ id: "x" })], new Map());
    expect(balances.map((one) => one.currency)).toEqual(["GBP", "AUD"]);
  });
});

describe("overviewOf", () => {
  it("adds this month's sales less refunds, the payable margin and the orders", () => {
    const overview = overviewOf(MONTH_OF_SALES, NOW);
    expect(overview).toMatchObject({ currency: "GBP", salesMinor: 9000 + 4800 + 6000, marginMinor: 2956 + 1700 + 1500, orders: 4, refunds: 1 });
  });

  it("ranks products by margin, five at most", () => {
    const top = overviewOf(MONTH_OF_SALES, NOW).top;
    expect(top.map((line) => line.name)).toEqual(["Home shirt 2027", "Away shirt 2027", "Training tee"]);
    expect(top[0]).toEqual({ name: "Home shirt 2027", units: 3, salesMinor: 9000, marginMinor: 2956 });
    const many = Array.from({ length: 7 }, (_, index) => sale({ id: `s${index}`, productName: `P${index}`, marginMinor: index }));
    expect(overviewOf(many, NOW).top).toHaveLength(5);
  });

  it("leaves last month out of the month's figures", () => {
    expect(overviewOf([sale({ soldAt: "2026-10-30T00:00:00.000Z" })], NOW)).toMatchObject({ salesMinor: 0, orders: 0, top: [{ name: "Home shirt 2027" }] });
  });

  it("reads in the currency most sales are in", () => {
    expect(mainCurrency([])).toBe("GBP");
    expect(mainCurrency([sale({ currency: "AUD" }), sale({ currency: "AUD" }), sale()])).toBe("AUD");
  });
});

describe("the weekly run", () => {
  it("is on the day and hour the scheduler runs it", () => {
    const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(vercel.crons.find((cron) => cron.path === "/api/cron/seller-payouts")?.schedule).toBe(`0 ${PAYOUT_HOUR_UTC} * * ${PAYOUT_WEEKDAY}`);
  });

  it("is the next Friday at nine, or today's when it is still to come", () => {
    expect(nextPayoutDate(NOW).toISOString()).toBe("2026-11-20T09:00:00.000Z");
    expect(nextPayoutDate(new Date("2026-11-13T08:00:00.000Z")).toISOString()).toBe("2026-11-13T09:00:00.000Z");
    expect(nextPayoutDate(new Date("2026-11-10T08:00:00.000Z")).toISOString()).toBe("2026-11-13T09:00:00.000Z");
    expect(dayLabel(new Date("2026-11-20T09:00:00.000Z"))).toBe("Friday 20 Nov");
  });
});

describe("accountView", () => {
  it("says payouts are coming when Connect is not switched on, or not set up when it is", () => {
    expect(accountView(null, false).state).toBe("unavailable");
    expect(accountView(null, true)).toMatchObject({ state: "none", pill: "Not set up" });
  });

  it("follows Stripe's account through onboarding to active", () => {
    expect(accountView(account({ detailsSubmitted: false, payoutsEnabled: false }), true).state).toBe("onboarding");
    expect(accountView(account({ payoutsEnabled: false, requirementsDue: 2 }), true)).toMatchObject({ state: "restricted", body: expect.stringContaining("2 more details") });
    expect(accountView(account({ payoutsEnabled: false, requirementsDue: 1 }), true).body).toContain("one more detail");
    expect(accountView(account(), true)).toMatchObject({ state: "active", tone: "ok" });
    expect(accountView(account({ payoutFailure: "Stripe could not pay your bank." }), true)).toMatchObject({ state: "active", tone: "warn" });
  });
});

describe("saleState", () => {
  it("names each state a sale can be in", () => {
    expect(saleState(sale(), 0).label).toBe("Waiting for delivery");
    expect(saleState(sale({ deliveredAt: NOW.toISOString() }), 0).label).toBe("Owed");
    expect(saleState(sale({ deliveredAt: NOW.toISOString() }), 1478).label).toBe("Paid out");
    expect(saleState(sale({ deliveredAt: NOW.toISOString(), refundedMinor: 500 }), 1478).label).toBe("Refund taken off next payout");
    expect(saleState(sale({ refundedMinor: 4500 }), 0).label).toBe("Refunded");
  });

  it("writes money in the sale's currency", () => {
    expect(money(61200, "GBP")).toBe("£612.00");
  });
});
