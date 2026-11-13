import { describe, expect, it, vi } from "vitest";
import { CHECKOUT_NOT_SET_UP } from "@/lib/payments/checkout";
import { testProvider } from "@/lib/payments/test-provider";
import type { PaymentProvider } from "@/lib/payments/provider";
import { AppError } from "@/lib/server/core/errors";
import { accessHashOf, newAccessToken, NAME_REFUSED, orderPagePath, payPath, shopOrderBody, startShopCheckout, tokenOpens, type ShopCheckoutDeps } from "./checkout";

const LISTING = { id: "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d", brandId: "brand", title: "Home shirt", slug: "lions" };
const TOKEN = "a".repeat(48);
const BODY = shopOrderBody.parse({ listingId: LISTING.id, size: "M", qty: "2", name: "", number: "", email: "fan@example.test", country: "GB", sizeConfirmed: true, returnsAccepted: true });

const clear = { result: "clear" as const, reasons: [] };

function deps(provider: PaymentProvider | null, over: Partial<ShopCheckoutDeps> = {}) {
  const open = vi.fn(async () => ({ shopOrderId: "order-1", paymentId: "pay-1", amountMinor: 9000, currency: "GBP" as const, brandId: "brand" }));
  const attach = vi.fn(async () => undefined);
  const screen = vi.fn(async () => clear);
  return { deps: { provider, siteUrl: "http://localhost:3000", open, attach, screen, newToken: () => TOKEN, ...over } satisfies ShopCheckoutDeps, open, attach, screen };
}

describe("a shopper's checkout", () => {
  it("checks the form: a size, 1–20, an email, GB or AU, and both ticks", () => {
    expect(BODY).toMatchObject({ qty: 2, name: "", number: "" });
    const bad = shopOrderBody.safeParse({ listingId: LISTING.id, size: "", qty: 30, email: "nope", country: "US", sizeConfirmed: false, returnsAccepted: false });
    expect(bad.success).toBe(false);
    expect(Object.keys(bad.error!.flatten().fieldErrors).sort()).toEqual(["country", "email", "qty", "returnsAccepted", "size", "sizeConfirmed"]);
  });

  it("opens the order with the token's hash, then the processor's checkout, and sends the shopper to the test page", async () => {
    const { deps: d, open, attach } = deps(testProvider({ siteUrl: "http://localhost:3000", newId: () => "abc123def456" }));
    const reply = await startShopCheckout(d, LISTING, BODY);
    expect(open).toHaveBeenCalledWith({ ...BODY, accessHash: accessHashOf(TOKEN) });
    expect(attach).toHaveBeenCalledWith("pay-1", "test", "cs_test_kw_abc123def456");
    expect(reply).toEqual({ shopOrderId: "order-1", url: `/shop/lions/pay/cs_test_kw_abc123def456?o=order-1&t=${TOKEN}` });
  });

  it("asks a real processor for its page, coming back to the shopper's own order page", async () => {
    const createCheckout = vi.fn(async () => ({ sessionId: "cs_live", url: "https://checkout.stripe.com/c/cs_live" }));
    const { deps: d } = deps({ name: "stripe", createCheckout, refund: vi.fn() });
    await expect(startShopCheckout(d, LISTING, BODY)).resolves.toEqual({ shopOrderId: "order-1", url: "https://checkout.stripe.com/c/cs_live" });
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay-1", amountMinor: 9000, currency: "GBP", mode: "payment", customerEmail: "fan@example.test", name: "Home shirt",
        successUrl: `http://localhost:3000/shop/lions/order/order-1?t=${TOKEN}`, cancelUrl: `http://localhost:3000/shop/lions/order/order-1?t=${TOKEN}&cancelled=1`,
      }),
    );
  });

  it("refuses before opening anything: no processor, another listing, a name the screen blocks", async () => {
    const none = deps(null);
    await expect(startShopCheckout(none.deps, LISTING, BODY)).rejects.toThrow(CHECKOUT_NOT_SET_UP);
    await expect(startShopCheckout(none.deps, { ...LISTING, id: "other" }, BODY)).rejects.toBeInstanceOf(AppError);
    const blocked = deps(testProvider({ siteUrl: "http://localhost:3000" }), { screen: vi.fn(async () => ({ result: "blocked" as const, reasons: [] })) });
    await expect(startShopCheckout(blocked.deps, LISTING, { ...BODY, name: "Bad" })).rejects.toThrow(NAME_REFUSED);
    expect(none.open).not.toHaveBeenCalled();
    expect(blocked.open).not.toHaveBeenCalled();
    const flagged = deps(testProvider({ siteUrl: "http://localhost:3000" }), { screen: vi.fn(async () => ({ result: "flagged" as const, reasons: [] })) });
    await expect(startShopCheckout(flagged.deps, { ...LISTING, title: "" }, { ...BODY, name: "Ali" })).resolves.toMatchObject({ shopOrderId: "order-1" });
  });

  it("opens the order page only with the right token", () => {
    const token = newAccessToken();
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(tokenOpens(token, accessHashOf(token))).toBe(true);
    expect(tokenOpens(TOKEN, accessHashOf(token))).toBe(false);
    expect(tokenOpens(undefined, accessHashOf(token))).toBe(false);
    expect(tokenOpens("short", accessHashOf("short"))).toBe(false);
    expect(orderPagePath("lions", "o", "t")).toBe("/shop/lions/order/o?t=t");
    expect(payPath("lions", "cs", "o", "t")).toBe("/shop/lions/pay/cs?o=o&t=t");
  });
});
