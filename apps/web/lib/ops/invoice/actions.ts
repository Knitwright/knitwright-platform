"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { brandNameOf } from "../packing/service";
import { opsContext } from "../qc/guard";
import { loadOrder } from "../service";
import { loadInvoiceSource } from "./load";
import { buildInvoice } from "./model";
import { issueInvoiceSchema } from "./schemas";
import { issueInvoice } from "./service";

const ops = opsContext;

/**
 * Issues a commercial invoice for an order (F-O4). It is a record: once issued it stands, and a correction is
 * a new invoice that names the one it replaces. Every field comes from a row, and what is not on file is named
 * on the document rather than guessed at.
 */
export const issueInvoiceAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.export,
  schema: issueInvoiceSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    const client = await sessionClient();
    const { order } = await loadOrder(client, input.orderId);
    const brandName = await brandNameOf(adminClient(), order.brandId);
    const source = await loadInvoiceSource(client, admin, {
      order,
      brandName,
      destinationCountry: input.destinationCountry,
      issuedOn: input.issuedOn,
      incoterms: input.incoterms,
    });
    const built = buildInvoice(source);
    if (built.status === "blocked") throw new AppError("conflict", built.blockers.join(" "));
    const issued = await issueInvoice(admin, actor, built.invoice, { replacesId: input.replacesId === "" ? null : input.replacesId });
    revalidatePath(`/ops/orders/${input.orderId}`);
    revalidatePath(`/ops/orders/${input.orderId}/shipping`);
    return { invoiceNo: issued.invoiceNo, missing: built.invoice.missing };
  },
});
