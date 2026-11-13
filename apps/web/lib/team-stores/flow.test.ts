import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { testProvider } from "@/lib/payments/test-provider";
import type { PaymentProvider } from "@/lib/payments/provider";
import { AppError } from "@/lib/server/core/errors";
import { ALREADY_STARTED, STORE_NOT_OPEN, buyerReturnUrls, startStoreCheckout, type BuyDeps } from "./checkout";
import { NOBODY_TO_ORDER, closeStore, sweepStores, type CloseDeps } from "./close";
import { memoryTeamStores } from "./fixtures/memory-store";
import { NOW, fixtureStore } from "./fixtures/stores";

const SITE = "https://knitwright.example";
const CODE = fixtureStore().code;
const line = (sizeLabel = "M", printName = "", printNumber = "") => ({ sizeLabel, printName, printNumber });
const order = (lines = [line()]) => ({ code: CODE, requestKey: randomUUID(), buyerName: "Sam Parent", buyerEmail: "sam@example.test", lines });

const setUp = (over: Partial<BuyDeps> = {}, stores = [fixtureStore()]) => {
  const memory = memoryTeamStores(stores);
  const provider = testProvider({ siteUrl: SITE });
  const deps: BuyDeps = { stores: memory.store, payments: memory.payments.store, provider, siteUrl: SITE, screenName: async () => ({ blocked: false, message: null }), now: () => NOW, ...over };
  return { memory, deps, provider };
};

const refusal = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as AppError);

describe("buying from a team store", () => {
  it("opens one payment at the store's own price and sends the buyer to the store's own test checkout", async () => {
    const { memory, deps } = setUp();
    const reply = await startStoreCheckout(deps, order([line("M", "KHAN", "10"), line("S")]));
    expect(reply.url).toMatch(new RegExp(`^${SITE}/t/${CODE}/pay/cs_test_kw_`));
    const payment = await memory.payments.store.payment(reply.paymentId);
    expect(payment).toMatchObject({ purpose: "team_store", method: "card", status: "open", amountMinor: 6380, provider: "test" });
  });

  it("uses Stripe's own page when Stripe is the processor, and returns to the store's pages", async () => {
    const createCheckout = vi.fn<PaymentProvider["createCheckout"]>(async () => ({ sessionId: "cs_live_like", url: "https://checkout.stripe.example/x" }));
    const { deps } = setUp({ provider: { name: "stripe", createCheckout, refund: vi.fn() } });
    const reply = await startStoreCheckout(deps, order());
    expect(reply.url).toBe("https://checkout.stripe.example/x");
    expect(createCheckout.mock.calls[0]![0]).toMatchObject({ mode: "payment", amountMinor: 3190, customerEmail: "sam@example.test", ...buyerReturnUrls(SITE, CODE, reply.paymentId) });
  });

  it("refuses a closed store, an unknown one, a bad piece, a blocked name and a deploy with no checkout", async () => {
    expect((await refusal(startStoreCheckout(setUp({}, [fixtureStore({ status: "closed" })]).deps, order())))?.message).toBe(STORE_NOT_OPEN);
    expect((await refusal(startStoreCheckout(setUp().deps, { ...order(), code: "Zz9zZz9zZz" })))?.code).toBe("not_found");
    const bad = await refusal(startStoreCheckout(setUp().deps, order([line("XXS")])));
    expect(bad?.fields?.lines).toEqual(["Piece 1: Choose one of the sizes on offer."]);
    const blocked = await refusal(startStoreCheckout(setUp({ screenName: async () => ({ blocked: true, message: null }) }).deps, order([line("M", "RUDE")])));
    expect(blocked?.fields?.lines?.[0]).toMatch(/^Piece 1: That name cannot be printed/);
    expect((await refusal(startStoreCheckout(setUp({ provider: null }).deps, order())))?.code).toBe("unavailable");
  });

  it("does not open a second checkout for the same order", async () => {
    const { deps } = setUp();
    const first = order();
    await startStoreCheckout(deps, first);
    expect((await refusal(startStoreCheckout(deps, first)))?.message).toBe(ALREADY_STARTED);
  });
});

const closeSetUp = (store = fixtureStore({ closesAt: "2020-01-01T00:00:00Z", minPieces: 2 })) => {
  const memory = memoryTeamStores([store]);
  const provider = testProvider({ siteUrl: SITE });
  const refund = vi.fn<CloseDeps["refund"]>(async (payment, amountMinor, reason) => {
    await memory.payments.store.recordRefund(payment.id, amountMinor, `re_${payment.id}`, reason, null);
  });
  const submit = vi.fn<CloseDeps["submit"]>(async () => ({ orderId: "00000000-0000-4000-8000-0000000000aa", runId: "00000000-0000-4000-8000-0000000000bb" }));
  const sales = { record: vi.fn<CloseDeps["sales"]["record"]>(async () => undefined), refund: vi.fn<CloseDeps["sales"]["refund"]>(async () => undefined) };
  const deps: CloseDeps = { stores: memory.store, submit, payment: memory.payments.store.payment, refund, sales, log: vi.fn() };
  const buy = async (lines = [line()]) => {
    const opened = await memory.store.openPurchase(order(lines));
    await memory.pay(opened.paymentId);
    return opened.paymentId;
  };
  return { memory, deps, submit, refund, sales, buy, provider, storeId: store.id };
};

describe("closing a team store", () => {
  it("makes every paid piece one run order, sent as the person who opened the store", async () => {
    const { deps, submit, buy, storeId, memory, sales } = closeSetUp();
    await buy([line("M"), line("L")]);
    await buy([line("M")]);
    await memory.store.openPurchase(order([line("S")]));
    const result = await closeStore(deps, storeId);
    expect(result).toMatchObject({ status: "closed", refunded: 0 });
    // The club's margin goes to C5's payouts: each counted purchase as a sale, then with the order attached.
    expect(sales.record.mock.calls.map((call) => call[2])).toEqual([null, null, "00000000-0000-4000-8000-0000000000aa", "00000000-0000-4000-8000-0000000000aa"]);
    const [sent, who] = submit.mock.calls[0]!;
    expect(sent.closeSizes).toEqual({ M: 2, L: 1 });
    expect(who).toEqual({ brandId: fixtureStore().brandId, userId: fixtureStore().createdBy });
  });

  it("refunds everyone in full below the minimum, and then says refunded", async () => {
    const { deps, submit, refund, buy, storeId } = closeSetUp(fixtureStore({ closesAt: "2020-01-01T00:00:00Z", minPieces: 5 }));
    await buy();
    await buy([line("S"), line("L")]);
    expect(await closeStore(deps, storeId)).toMatchObject({ status: "refunded", refunded: 2 });
    expect(submit).not.toHaveBeenCalled();
    expect(refund.mock.calls.map((call) => call[1])).toEqual([3190, 6380]);
    expect(await closeStore(deps, storeId)).toMatchObject({ status: "refunded", refunded: 0 });
  });

  it("refunds everyone when production refuses the order, in production's words", async () => {
    const { deps, submit, buy, storeId, memory, sales } = closeSetUp();
    submit.mockRejectedValueOnce(new AppError("conflict", "This design no longer passes its checks."));
    await buy([line("M"), line("M")]);
    expect(await closeStore(deps, storeId)).toMatchObject({ status: "refunded", refunded: 1 });
    expect(memory.rows.get(storeId)?.closeMessage).toBe("Production refused the order: This design no longer passes its checks.");
    expect(sales.refund).toHaveBeenCalledTimes(1);
    expect(sales.refund.mock.calls[0]![1]).toBe(6380);
  });

  it("leaves a fault for the next run, and refunds when nobody is left to order", async () => {
    const faulty = closeSetUp();
    faulty.submit.mockRejectedValueOnce(new Error("database down"));
    await faulty.buy([line(), line()]);
    expect(await sweepStores(faulty.deps, NOW)).toEqual([]);
    expect(faulty.deps.log).toHaveBeenCalled();
    expect(await closeStore(faulty.deps, faulty.storeId)).toMatchObject({ status: "closed" });

    const orphan = closeSetUp(fixtureStore({ closesAt: "2020-01-01T00:00:00Z", minPieces: 1, createdBy: null }));
    await orphan.buy();
    expect(await closeStore(orphan.deps, orphan.storeId)).toMatchObject({ status: "refunded", refunded: 1 });
    expect(orphan.memory.rows.get(orphan.storeId)?.closeMessage).toBe(NOBODY_TO_ORDER);
  });

  it("refunds a payment that arrived after the close counted, and keeps the counted ones", async () => {
    const { deps, buy, storeId, memory, refund } = closeSetUp(fixtureStore({ closesAt: "2020-01-01T00:00:00Z", minPieces: 1 }));
    await buy();
    const late = await memory.store.openPurchase(order());
    expect(await closeStore(deps, storeId)).toMatchObject({ status: "closed" });
    await memory.pay(late.paymentId);
    expect(await closeStore(deps, storeId)).toMatchObject({ status: "closed", refunded: 1 });
    expect(refund.mock.calls[0]![2]).toMatch(/after the store closed/);
  });

  it("does nothing to a store still open, and a refund that fails is logged and tried again", async () => {
    const open = closeSetUp(fixtureStore({ closesAt: "2999-01-01T00:00:00Z" }));
    expect(await closeStore(open.deps, open.storeId)).toMatchObject({ status: "open", refunded: 0 });

    const failing = closeSetUp(fixtureStore({ closesAt: "2020-01-01T00:00:00Z", minPieces: 9 }));
    await failing.buy();
    failing.refund.mockRejectedValueOnce(new Error("Stripe down"));
    expect(await closeStore(failing.deps, failing.storeId)).toMatchObject({ status: "refunding", refunded: 0 });
    expect(await closeStore(failing.deps, failing.storeId)).toMatchObject({ status: "refunded", refunded: 1 });
  });

  it("closes or cancels on the club's word", async () => {
    const { memory, deps, buy } = closeSetUp(fixtureStore({ minPieces: 1 }));
    await buy();
    await memory.store.endStore({ brandId: "b", userId: "u" }, fixtureStore().id, "cancel");
    expect(await closeStore(deps, fixtureStore().id)).toMatchObject({ status: "refunded", refunded: 1 });
    await expect(memory.store.endStore({ brandId: "b", userId: "u" }, fixtureStore().id, "close")).rejects.toThrow();
  });
});
