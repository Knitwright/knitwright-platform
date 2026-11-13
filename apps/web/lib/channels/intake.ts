import { AppError } from "@/lib/server/core/errors";
import type { LineRow, NewLine } from "@/lib/payments/store";
import type { ChannelsStore, IncomingLine } from "./store";

/**
 * ORDER INTAKE (plan v6 C4, decision 0155; spec F-L6 "pull orders", "an order in a connected Shopify store appears
 * in ops within 5 minutes").
 *
 * A channel's order is recorded line by line once (`channel_receive_order_line`), then sent to production through
 * the same door every app order uses: C1's payment opened as an INVOICE (the buyer paid the brand on its own shop,
 * and Knitwright invoices the brand for making it), then C1's fulfilment, which calls `submit_brand_run` as the
 * member the order is placed for. So C1's payment gate, the golden sample and stage rules, and D1's validation gate
 * all run on a channel order exactly as on any other, and a refusal comes back in their words.
 *
 * Every step is idempotent: a line already settled is skipped; a line still waiting (a failure part-way) is sent
 * again, and `open_order_payment` answers a repeated request key with the payment it already opened.
 */

/** An incoming line with the terms it is made on: the release, fabric and factory profile fixed when listed. */
export type ResolvedLine = IncomingLine &
  Readonly<{ projectId: string; releaseId: string; factoryProfileId: string; fabricKey: string; flags: readonly Readonly<{ code: string; text: string }>[] }>;

export type IntakeDeps = Readonly<{
  store: ChannelsStore;
  /** C1's `open_order_payment`, as an invoice. Answers the payment id. */
  openInvoice: (input: Readonly<{ brandId: string; userId: string; description: string; currency: "GBP" | "AUD"; lines: readonly NewLine[] }>) => Promise<string>;
  /** C1's fulfilment of a payment's waiting lines. */
  fulfil: (paymentId: string) => Promise<unknown>;
  paymentLines: (paymentId: string) => Promise<readonly LineRow[]>;
}>;

export type IntakeResult = Readonly<{ received: number; submitted: number; refused: number; messages: readonly string[] }>;

export const NO_ACTOR = "The person who connected this shop is no longer a member who may order. Connect the shop again.";

const PREFIX: Readonly<Record<IncomingLine["channel"], string>> = { shopify: "shp", csv: "csv" };

/** The request key of a channel line: `shp-<order>-<line>`, unique per brand, at most 64 characters. */
export const requestKeyOf = (line: Pick<IncomingLine, "channel" | "externalOrderId" | "externalLineId">): string =>
  `${PREFIX[line.channel]}-${line.externalOrderId}-${line.externalLineId}`.slice(0, 64);

/** The currency of the invoice: the shop's, where it is one we sell in. Nothing is charged either way. */
export const invoiceCurrency = (currency: string): "GBP" | "AUD" => (currency === "AUD" ? "AUD" : "GBP");

const paymentLineOf = (line: ResolvedLine): NewLine => ({
  requestKey: requestKeyOf(line),
  door: "brand_run",
  productId: line.productId,
  projectId: line.projectId,
  kind: "run",
  releaseId: line.releaseId,
  factoryProfileId: line.factoryProfileId,
  fabricKey: line.fabricKey,
  sizes: { [line.sizeLabel]: line.pieces },
  flags: [{ code: `channel_${line.channel}`, text: `${line.channel === "shopify" ? "Shopify" : "CSV"} order ${line.orderName}: ship to the buyer (address on the channel order).` }, ...line.flags].slice(0, 50),
  pieces: line.pieces,
  valueMinor: null,
  priceLabel: null,
});

const refusalOf = (error: unknown): string => {
  if (error instanceof AppError && error.code !== "internal" && error.code !== "unavailable") return error.message;
  throw error;
};

export async function takeOrder(
  deps: IntakeDeps,
  order: Readonly<{ brandId: string; actor: string | null; description: string; currency: string; lines: readonly ResolvedLine[] }>,
): Promise<IntakeResult> {
  const waiting: (ResolvedLine & { channelLineId: string })[] = [];
  for (const line of order.lines) {
    const received = await deps.store.receiveLine(line);
    if (received.state === "received") waiting.push({ ...line, channelLineId: received.id });
  }
  if (waiting.length === 0) return { received: 0, submitted: 0, refused: 0, messages: [] };

  const refuseAll = async (message: string): Promise<IntakeResult> => {
    for (const line of waiting) await deps.store.settleLine(line.channelLineId, "refused", message, { paymentId: null, orderId: null, runId: null });
    return { received: waiting.length, submitted: 0, refused: waiting.length, messages: [message] };
  };
  if (order.actor === null) return refuseAll(NO_ACTOR);

  let paymentId: string;
  try {
    paymentId = await deps.openInvoice({ brandId: order.brandId, userId: order.actor, description: order.description, currency: invoiceCurrency(order.currency), lines: waiting.map(paymentLineOf) });
  } catch (error) {
    return refuseAll(refusalOf(error));
  }
  await deps.fulfil(paymentId);

  const sent = new Map((await deps.paymentLines(paymentId)).map((row) => [row.requestKey, row]));
  let submitted = 0;
  let refused = 0;
  const messages: string[] = [];
  for (const line of waiting) {
    const row = sent.get(requestKeyOf(line));
    if (!row || row.status === "waiting") continue;
    const refs = { paymentId, orderId: row.orderId, runId: row.runId };
    await deps.store.settleLine(line.channelLineId, row.status, row.status === "refused" ? (row.message ?? "Refused.") : null, refs);
    if (row.status === "submitted") submitted += 1;
    else {
      refused += 1;
      messages.push(row.message ?? "Refused.");
    }
  }
  return { received: waiting.length, submitted, refused, messages: [...new Set(messages)] };
}
