import { z } from "zod";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { fileResponse } from "@/lib/ops/download";
import { commercialInvoicePdf } from "@/lib/ops/invoice/pdf";
import { invoiceFromRecord, loadIssuedInvoice } from "@/lib/ops/invoice/record";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const maxDuration = 60;

const params = z.object({ orderId: z.uuid() });
const query = z.object({ invoice: z.coerce.number().int().min(1).max(999).optional() });

const safe = (text: string): string => text.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60) || "order";

/**
 * An invoice that has already been issued, as a PDF. The document is rendered from the record, never from the
 * rows as they are now, so a reprint of invoice 1 always shows what invoice 1 said. Platform admins only.
 */
export const GET = defineRoute({
  auth: "user",
  rateLimit: LIMITS.export,
  schema: { params, query },
  handler: async ({ input }) => {
    const client = await sessionClient();
    await assertPlatformAdmin(client);
    const { order, brandName, invoice } = await loadIssuedInvoice(client, adminClient(), input.params.orderId, input.query.invoice);
    const pdf = await commercialInvoicePdf(invoiceFromRecord(order, brandName, invoice));
    return fileResponse(pdf, "application/pdf", `${safe(order.externalRef)}-commercial-invoice-${invoice.invoiceNo}.pdf`);
  },
});
