import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopFrame } from "@/components/storefront/shop/ShopFrame";
import { ShopTestPay } from "@/components/storefront/shop/ShopTestPay";
import { Notice } from "@/components/ui/Notice";
import { formatMoney } from "@/lib/factory/pricing";
import { payments, paymentsStore } from "@/lib/payments/server";
import { isTestSession } from "@/lib/payments/test-provider";
import { tokenOpens } from "@/lib/storefront/checkout";
import { shopOrderById, storefrontBySlug } from "@/lib/storefront/db";
import { adminClient } from "@/lib/server/deps";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * THE STOREFRONT'S TEST CHECKOUT (decision 0154, after C1's `/checkout/test`): where Stripe's page would be on a deploy
 * with no Stripe keys and PAYMENTS_TEST_CHECKOUT on. The shopper has no session, so the order's own token is the key:
 * without it, on any other deploy, or for another storefront's checkout, the page does not exist.
 */
export default async function ShopTestCheckoutPage({ params, searchParams }: PageProps<"/shop/[store]/pay/[sessionId]">) {
  const { store, sessionId } = await params;
  const query = await searchParams;
  const orderId = typeof query.o === "string" && UUID.test(query.o) ? query.o : null;
  const token = typeof query.t === "string" ? query.t : undefined;
  if (payments()?.provider.name !== "test" || !isTestSession(sessionId) || orderId === null) notFound();
  const admin = adminClient();
  const [storefront, order, payment] = await Promise.all([storefrontBySlug(admin, store), shopOrderById(admin, orderId), paymentsStore().paymentBySession(sessionId)]);
  if (storefront === null || order === null || payment === null || order.paymentId !== payment.id || order.brandId !== storefront.brandId || !tokenOpens(token, order.accessHash)) notFound();

  return (
    <ShopFrame name={storefront.name} slug={storefront.slug} accent={null}>
      <h1 className="text-h1 text-text">Test checkout</h1>
      <p className="text-body-lg text-text-2">{payment.description}: {formatMoney(payment.amountMinor, payment.currency)}</p>
      <Notice tone="info">This is the test checkout. No card is charged and no money moves. On a deploy with Stripe set up, this is Stripe&apos;s own page.</Notice>
      {payment.status === "open" ? (
        <ShopTestPay slug={storefront.slug} sessionId={sessionId} orderId={order.id} token={token ?? ""} />
      ) : (
        <Notice tone="warn" role="alert">This checkout is already {payment.status === "expired" ? "closed" : "paid"}.</Notice>
      )}
    </ShopFrame>
  );
}
