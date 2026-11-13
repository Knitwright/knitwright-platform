import "server-only";
import { submitRun } from "@/lib/brand-runs/service";
import { getEnv } from "@/lib/config/env";
import { creditsService } from "@/lib/credits/server";
import { designVersionHash } from "@/lib/credits/version-hash";
import { submitMakeOrder } from "@/lib/make/service";
import { adminClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { startOrderCheckout, type Buyer, type CheckoutDeps, type OrderLineIntent } from "./checkout";
import { supabaseStore } from "./db";
import { fulfilPayment, type FulfilDeps } from "./fulfil";
import { refundPayment } from "./refunds";
import { paymentsFrom, type Payments } from "./select";
import type { PayCurrency, Schedule } from "./settings";
import type { LineRow } from "./store";
import { receiveWebhook, type WebhookAnswer } from "./webhook";

/**
 * The payments code wired to the database, the processor chosen by the environment, the make and brand-run doors,
 * the credit ledger and the log (plan v6 C1, decision 0152). No rules live here; the database and browser tests
 * cover the joins.
 */

export const payments = (): Payments | null => paymentsFrom(getEnv());

const store = () => supabaseStore(adminClient());

/** Sends one paid line through its own door, as the person who paid. */
const submitLine: FulfilDeps["submit"] = async (line, who) => {
  const order = { productId: line.productId, kind: line.kind, releaseId: line.releaseId, factoryProfileId: line.factoryProfileId, fabricKey: line.fabricKey, sizes: line.sizes, flags: line.flags, requestKey: line.requestKey };
  const sent = line.door === "make" ? await submitMakeOrder(adminClient(), who, order) : await submitRun(adminClient(), who, order);
  return { orderId: sent.orderId, runId: sent.runId, status: sent.status };
};

/** Decision 0132 D1-3: the credits spent on the ordered version come back as order credit. */
const creditsBack = async (line: LineRow, brandId: string): Promise<void> => {
  const { data } = await adminClient().from("production_releases").select("snapshot").eq("id", line.releaseId).maybeSingle();
  const version = Number((data?.snapshot as { specVersion?: unknown } | undefined)?.specVersion);
  if (!Number.isInteger(version) || version < 1) return;
  await creditsService().refundForOrder({ brandId, designVersionHash: designVersionHash(line.projectId, version) });
};

const fulfilDeps = (): FulfilDeps => ({
  store: store(),
  submit: submitLine,
  creditsBack,
  refund: async (payment, amountMinor, reason) => {
    await refundPayment({ store: store(), provider: payments()?.provider ?? null }, payment, amountMinor, reason, null);
  },
  log,
});

export const fulfil = (paymentId: string) => fulfilPayment(fulfilDeps(), paymentId);

export const checkoutDeps = (): CheckoutDeps => ({ store: store(), provider: payments()?.provider ?? null, siteUrl: getEnv().NEXT_PUBLIC_SITE_URL, fulfil });

/** Every app door's way to production: pay for these orders (or invoice them where unpriced). */
export const checkoutOrders = (buyer: Buyer, input: Readonly<{ lines: readonly OrderLineIntent[]; currency: PayCurrency; schedule: Schedule; description: string }>) =>
  startOrderCheckout(checkoutDeps(), buyer, input);

/** The webhook, with this deploy's secret. Without a processor nothing is read: 503. */
export async function handleWebhook(raw: string, signature: string | null): Promise<WebhookAnswer | null> {
  const chosen = payments();
  if (chosen === null) return null;
  return receiveWebhook(
    { secret: chosen.webhookSecret, provider: chosen.provider.name, nowSeconds: () => Math.floor(Date.now() / 1000), store: store(), fulfil, log },
    raw,
    signature,
  );
}

export const paymentsStore = store;
