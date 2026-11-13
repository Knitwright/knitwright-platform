import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopFrame } from "@/components/storefront/shop/ShopFrame";
import { Notice } from "@/components/ui/Notice";
import { formatMoney } from "@/lib/factory/pricing";
import { paymentsStore } from "@/lib/payments/server";
import { orderPagePath, tokenOpens } from "@/lib/storefront/checkout";
import { shopOrderById, storefrontBySlug } from "@/lib/storefront/db";
import { shopPath } from "@/lib/storefront/host";
import { shopOrderHeadline } from "@/lib/storefront/order-view";
import { adminClient } from "@/lib/server/deps";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

/**
 * THE SHOPPER'S ORDER PAGE (decision 0154): where Stripe sends the shopper back. The token in the address is the only
 * key; the database keeps its hash. It reads the payment and says where the order stands; nothing here changes it.
 */
export default async function ShopOrderPage({ params, searchParams }: PageProps<"/shop/[store]/order/[orderId]">) {
  const { store, orderId } = await params;
  const query = await searchParams;
  const token = typeof query.t === "string" ? query.t : undefined;
  const admin = adminClient();
  const [storefront, order] = await Promise.all([storefrontBySlug(admin, store), shopOrderById(admin, orderId).catch(() => null)]);
  if (storefront === null || order === null || order.brandId !== storefront.brandId || !tokenOpens(token, order.accessHash)) notFound();
  const payment = await paymentsStore().payment(order.paymentId);
  if (payment === null) notFound();
  const headline = shopOrderHeadline({ status: payment.status, cancelled: query.cancelled === "1", batched: order.batchId !== null });

  return (
    <ShopFrame name={storefront.name} slug={storefront.slug} accent={null}>
      <h1 className="text-h1 text-text" data-testid="shop-order-title">{headline.title}</h1>
      <Notice tone={headline.tone} role={headline.tone === "warn" ? "alert" : "status"}>{headline.body}</Notice>
      <dl className="grid max-w-120 grid-cols-2 gap-2 text-body">
        <dt className="text-muted">Size</dt>
        <dd className="text-text">{order.size}</dd>
        <dt className="text-muted">Quantity</dt>
        <dd className="text-text">{order.qty}</dd>
        {order.personalName || order.personalNumber !== null ? (
          <>
            <dt className="text-muted">Name and number</dt>
            <dd className="text-text">{[order.personalName, order.personalNumber].filter((part) => part !== null && part !== "").join(" ")}</dd>
          </>
        ) : null}
        <dt className="text-muted">Total</dt>
        <dd className="text-text">{formatMoney(order.amountMinor, order.currency)}</dd>
      </dl>
      <div className="flex flex-wrap gap-3">
        {headline.waiting && token ? <Link href={orderPagePath(storefront.slug, order.id, token) as Route} className="text-link underline underline-offset-4">Check again</Link> : null}
        <Link href={shopPath(storefront.slug) as Route} className="text-link underline underline-offset-4">Back to the shop</Link>
      </div>
    </ShopFrame>
  );
}
