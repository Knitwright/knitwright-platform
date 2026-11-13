"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { disconnectChannelAction, pullShopifyOrdersAction, pushToShopifyAction, sendTestShopifyOrderAction, syncTrackingAction } from "@/lib/channels/actions";
import { formatMoney } from "@/lib/factory/pricing";
import { marginOf, type ChannelProduct, type ChannelsPage } from "@/lib/channels/view";
import { ChannelOrdersTable } from "./ChannelOrdersTable";
import { CONNECT_ROLE_REASON } from "./ChannelCardView";

/**
 * Manage a connected Shopify shop (screen 24 "Connected · Manage"; spec F-L6 wizard steps 3–5): set a retail price
 * per product with the profit per piece beside it, push it, pull orders a webhook missed, send tracking, and
 * disconnect. Each action answers in words; nothing happens silently.
 */

type Reply = Readonly<{ success: true; data: unknown } | { success: false; error: { message: string } }>;

const LIST_ROLE_REASON = "Only owners, admins and kit managers list products.";

const minorOf = (pounds: string): number | null => {
  const value = Number(pounds.trim());
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
};

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const run = (call: () => Promise<Reply>, done: (data: never) => string) =>
    start(async () => {
      const reply = await call().catch(() => null);
      if (!reply) return setSaid({ tone: "warn", text: "That could not reach the server. Check your connection and try again." });
      if (!reply.success) return setSaid({ tone: "warn", text: reply.error.message });
      setSaid({ tone: "ok", text: done(reply.data as never) });
      router.refresh();
    });
  return { pending, said, run };
}

type Intake = Readonly<{ received: number; submitted: number; refused: number; messages: readonly string[] }>;
const intakeText = (result: Intake): string =>
  result.received === 0 ? "No new orders." : `${result.submitted} sent to production, ${result.refused} refused.${result.messages.length > 0 ? ` ${result.messages.join(" ")}` : ""}`;

function ProductRow({ product, canList }: Readonly<{ product: ChannelProduct; canList: boolean }>) {
  const [price, setPrice] = useState(product.listing ? (product.listing.priceMinor / 100).toFixed(2) : "");
  const [fabric, setFabric] = useState(product.listing?.fabricKey ?? "");
  const { pending, said, run } = useRun();
  const priceMinor = minorOf(price);
  const margin = priceMinor === null ? null : marginOf(priceMinor, product.unitCostMinor);
  const reason = product.blocked ?? (canList ? (priceMinor === null || priceMinor < 100 ? "Set a retail price of at least £1.00 first." : undefined) : LIST_ROLE_REASON);
  return (
    <Tr>
      <Td>
        <span className="font-semibold">{product.name}</span>
        {product.blocked ? <span className="block text-small text-muted">{product.blocked}</span> : null}
        {said ? <span className={said.tone === "ok" ? "block text-small text-ok" : "block text-small text-bad-strong"} role="status">{said.text}</span> : null}
      </Td>
      <Td>{product.sizes.join(", ") || "None"}</Td>
      <Td numeric title={product.costNote}>
        {product.unitCostMinor === null ? <span className="text-muted">Invoiced</span> : formatMoney(product.unitCostMinor, "GBP")}
      </Td>
      <Td>
        <label className="sr-only" htmlFor={`price-${product.productId}`}>Retail price of {product.name} in pounds</label>
        <input id={`price-${product.productId}`} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" disabled={Boolean(product.blocked) || !canList} className="h-9 w-24 rounded-sm border border-border bg-bg px-2.5 text-right tabular-nums disabled:bg-soft" />
      </Td>
      <Td>
        <label className="sr-only" htmlFor={`fabric-${product.productId}`}>Fabric of {product.name}</label>
        <input id={`fabric-${product.productId}`} value={fabric} onChange={(event) => setFabric(event.target.value)} placeholder="Factory's first" maxLength={120} disabled={Boolean(product.blocked) || !canList} className="h-9 w-32 rounded-sm border border-border bg-bg px-2.5 disabled:bg-soft" />
      </Td>
      <Td numeric>{margin ? `${formatMoney(margin.profitMinor, "GBP")} · ${margin.marginPercent}%` : <span className="text-muted">—</span>}</Td>
      <Td>{product.listing ? `Listed, ${product.listing.sizes} sizes` : "Not listed"}</Td>
      <Td>
        <Button size="sm" pending={pending} disabledReason={reason} onClick={() => run(() => pushToShopifyAction({ productId: product.productId, priceMinor: priceMinor ?? 0, fabricKey: fabric.trim() === "" ? null : fabric.trim() }), (data: { sizes: number; fabric: string }) => `Pushed ${data.sizes} sizes, made in ${data.fabric}.`)}>
          {product.listing ? "Update" : "Push"}<span className="sr-only"> {product.name}</span>
        </Button>
      </Td>
    </Tr>
  );
}

export function ShopifyPanel({ page }: Readonly<{ page: ChannelsPage }>) {
  const { pending, said, run } = useRun();
  if (page.shopify.state !== "connected") return null;
  const { connection, testMode } = page.shopify;
  const listReason = page.canList ? undefined : LIST_ROLE_REASON;
  return (
    <section id="shopify-manage" aria-labelledby="shopify-manage-title" className="flex scroll-mt-24 flex-col gap-5 rounded-xl border border-border p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="shopify-manage-title" className="text-h3 text-text">Shopify · {connection.shop}</h2>
          <p className="text-small text-muted">Orders for the products you push come to Knitwright, are made in Sialkot and shipped to your buyers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" pending={pending} disabledReason={listReason} onClick={() => run(() => pullShopifyOrdersAction({}), intakeText)}>Pull orders</Button>
          <Button variant="secondary" size="sm" pending={pending} disabledReason={listReason} onClick={() => run(() => syncTrackingAction({}), (data: { synced: number; failed: number }) => `${data.synced} tracking numbers sent${data.failed > 0 ? `, ${data.failed} to try again` : ""}.`)}>Sync tracking</Button>
          {testMode ? <Button variant="secondary" size="sm" pending={pending} disabledReason={listReason} onClick={() => run(() => sendTestShopifyOrderAction({}), (data: { message: string }) => `Test order: ${data.message}`)}>Send a test order</Button> : null}
          <Button variant="danger" size="sm" pending={pending} disabledReason={page.canConnect ? undefined : CONNECT_ROLE_REASON} onClick={() => run(() => disconnectChannelAction({ connectionId: connection.id }), () => "Disconnected. Its token was deleted.")}>Disconnect</Button>
        </div>
      </header>
      {said ? <Notice tone={said.tone} role={said.tone === "warn" ? "alert" : "status"}>{said.text}</Notice> : null}
      {testMode ? <Notice tone="info">This is the Shopify stand-in for tests: nothing reaches a real shop.</Notice> : null}
      {connection.hasLocation ? null : <Notice tone="warn">Knitwright is not registered as this shop&apos;s fulfilment service yet. It is tried again on the next push.</Notice>}
      <div className="flex flex-col gap-2">
        <h3 className="text-title text-text">Products</h3>
        <p className="text-small text-muted">Pictures are not sent yet: add them in Shopify. Every size gets a SKU Knitwright reads back from the order.</p>
        {page.products.length === 0 ? (
          <p className="text-body text-muted">No products yet. Add one from a design&apos;s Make page.</p>
        ) : (
          <Table caption="Your products on Shopify">
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Sizes</Th>
                <Th numeric>Cost per piece</Th>
                <Th>Retail price (£)</Th>
                <Th>Fabric</Th>
                <Th numeric>Profit per piece</Th>
                <Th>On Shopify</Th>
                <Th><span className="sr-only">Action</span></Th>
              </tr>
            </thead>
            <tbody>
              {page.products.map((product) => <ProductRow key={product.productId} product={product} canList={page.canList} />)}
            </tbody>
          </Table>
        )}
      </div>
      <ChannelOrdersTable orders={page.orders.filter((order) => order.channel === "shopify")} caption="Orders from Shopify" />
    </section>
  );
}
