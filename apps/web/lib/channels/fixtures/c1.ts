import { AppError } from "@/lib/server/core/errors";
import type { LineRow, NewLine } from "@/lib/payments/store";
import type { IntakeDeps } from "../intake";
import type { ChannelsStore } from "../store";

/**
 * C1's payment door as the channel tests need it (decision 0155): an invoice opened once per first request key,
 * and a fulfilment that sends each waiting line unless its product is in `refuse`.
 */
export function fakeC1(store: ChannelsStore, options: Readonly<{ refuse?: ReadonlyMap<string, string>; openRefusal?: AppError; fail?: boolean }> = {}) {
  const payments = new Map<string, { brandId: string; userId: string; description: string; currency: string; lines: LineRow[] }>();
  const byKey = new Map<string, string>();
  let next = 0;
  const deps: IntakeDeps = {
    store,
    openInvoice: async (input) => {
      if (options.openRefusal) throw options.openRefusal;
      const known = byKey.get(input.lines[0]!.requestKey);
      if (known) return known;
      const id = `pay-${++next}`;
      payments.set(id, { ...input, lines: input.lines.map((line: NewLine, at) => ({ ...line, id: `${id}-${at}`, paymentId: id, status: "waiting", orderId: null, runId: null, message: null })) });
      for (const line of input.lines) byKey.set(line.requestKey, id);
      return id;
    },
    fulfil: async (paymentId) => {
      if (options.fail) throw new AppError("internal", "boom");
      const payment = payments.get(paymentId)!;
      payment.lines = payment.lines.map((line) => {
        if (line.status !== "waiting") return line;
        const refusal = options.refuse?.get(line.productId);
        return refusal ? { ...line, status: "refused", message: refusal } : { ...line, status: "submitted", orderId: `order-${line.requestKey}`, runId: `run-${line.requestKey}` };
      });
      return payment;
    },
    paymentLines: async (paymentId) => payments.get(paymentId)?.lines ?? [],
  };
  return { deps, payments };
}
