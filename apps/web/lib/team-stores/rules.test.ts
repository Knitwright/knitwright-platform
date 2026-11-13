import { describe, expect, it } from "vitest";
import { newStoreCode } from "./code";
import { NOW, fixtureStore } from "./fixtures/stores";
import { checkPurchase, isStoreCode, isTakingOrders, marginMinorOf, marginPercent, piecePriceMinor, sizesOf, storeAddress, whenText, windowState } from "./rules";

const line = (sizeLabel: string, printName = "", printNumber = "") => ({ sizeLabel, printName, printNumber });

describe("a store's prices", () => {
  it("adds the club's margin, rounded half up as the database does", () => {
    expect(marginMinorOf(2900, 1000)).toBe(290);
    expect(marginMinorOf(2905, 1000)).toBe(291);
    expect(marginMinorOf(2904, 1000)).toBe(290);
    expect(marginMinorOf(2900, 0)).toBe(0);
    expect(piecePriceMinor(fixtureStore())).toBe(3190);
    expect(marginPercent(1500)).toBe("15%");
  });
});

describe("a store's window", () => {
  it("is scheduled, open, due, or what the close made of it", () => {
    expect(windowState(fixtureStore({ opensAt: "2026-11-14T00:00:00Z" }), NOW)).toBe("scheduled");
    expect(windowState(fixtureStore(), NOW)).toBe("open");
    expect(windowState(fixtureStore({ closesAt: "2026-11-13T11:00:00Z" }), NOW)).toBe("due");
    expect(windowState(fixtureStore({ status: "refunded" }), NOW)).toBe("refunded");
    expect(isTakingOrders(fixtureStore(), NOW)).toBe(true);
    expect(isTakingOrders(fixtureStore({ status: "closing" }), NOW)).toBe(false);
  });

  it("says when, in words", () => {
    expect(whenText(fixtureStore(), NOW)).toBe("Closes in 8 days");
    expect(whenText(fixtureStore({ closesAt: "2026-11-14T06:00:00Z" }), NOW)).toBe("Closes within a day");
    expect(whenText(fixtureStore({ closesAt: "2026-11-15T06:00:00Z" }), NOW)).toBe("Closes in 2 days");
    expect(whenText(fixtureStore({ opensAt: "2026-11-16T00:00:00Z" }), NOW)).toBe("Opens in 3 days");
    expect(whenText(fixtureStore({ status: "closing" }), NOW)).toBe("Closing now");
    expect(whenText(fixtureStore({ status: "closed" }), NOW)).toMatch(/one order sent/);
    expect(whenText(fixtureStore({ status: "refunding" }), NOW)).toMatch(/refunding/);
    expect(whenText(fixtureStore({ status: "refunded" }), NOW)).toMatch(/was refunded/);
  });
});

describe("a purchase", () => {
  const store = fixtureStore();

  it("may go when every piece fits", () => {
    expect(checkPurchase(store, [line("M", "KHAN", "10"), line("S")])).toEqual([]);
  });

  it("is refused piece by piece, in words a parent can act on", () => {
    const problems = checkPurchase(store, [line("XXS"), line("M", "A VERY LONG NAME", "100"), line("L", "", "1a")]);
    expect(problems).toEqual([
      { index: 0, field: "size", message: "Choose one of the sizes on offer." },
      { index: 1, field: "name", message: "A shirt name here fits 12 characters. This one has 16." },
      { index: 1, field: "number", message: "A number here is 0 to 99." },
      { index: 2, field: "number", message: "A number here is 0 to 99." },
    ]);
  });

  it("is at least one piece and at most ten", () => {
    expect(checkPurchase(store, [])[0]?.message).toBe("Add a piece first.");
    expect(checkPurchase(store, Array.from({ length: 11 }, () => line("M")))[0]?.message).toBe("One order is up to 10 pieces.");
  });

  it("carries no name or number where the store prints none", () => {
    expect(checkPurchase(fixtureStore({ namesNumbers: false }), [line("M", "KHAN")])[0]?.message).toBe("This store prints no names or numbers.");
    expect(checkPurchase(fixtureStore({ namesNumbers: false }), [line("M")])).toEqual([]);
  });

  it("counts pieces by size", () => {
    expect(sizesOf([line("M"), line("S"), line("M")])).toEqual({ M: 2, S: 1 });
  });
});

describe("the short link", () => {
  it("is ten characters with no look-alikes, at /t/<code>", () => {
    const code = newStoreCode();
    expect(code).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(code).not.toMatch(/[0O1lI]/);
    expect(newStoreCode(() => 0)).toBe("AAAAAAAAAA");
    expect(isStoreCode(code)).toBe(true);
    expect(isStoreCode("short")).toBe(false);
    expect(isStoreCode(5)).toBe(false);
    expect(storeAddress("https://knitwright.example/", "Ab3dEf7hJk")).toBe("https://knitwright.example/t/Ab3dEf7hJk");
  });
});
