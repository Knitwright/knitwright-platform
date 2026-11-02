import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { sizesLine } from "../format";
import { brandNameOf } from "../packing/service";
import { loadOrder } from "../service";
import type { OpsOrder } from "../rows";
import { NO_DELIVERY_DATE, type InvoiceModel } from "./model";
import { listInvoices, type IssuedInvoice } from "./service";

/**
 * Printing an invoice that has already been issued. The document is built from the record, not from the rows
 * as they are now: an invoice is a record, so a reprint of invoice 1 shows exactly what invoice 1 said, and a
 * correction is a different invoice with its own number.
 */

export const NO_SUCH_INVOICE = "No invoice has been issued for this order yet.";

/** Turns the record back into the document. Nothing is recomputed, so nothing can drift. */
export function invoiceFromRecord(order: OpsOrder, brandName: string, record: IssuedInvoice): InvoiceModel {
  return {
    orderId: order.id,
    orderRef: order.externalRef,
    brandName,
    issuedOn: record.issuedOn,
    originCountry: record.originCountry,
    destinationCountry: record.destinationCountry,
    destinationName: record.destinationCountry,
    preferenceScheme: record.preferenceScheme,
    incoterms: record.incoterms,
    consignorLine: `Made in ${record.originCountry}`,
    lines: record.lines,
    totalPieces: record.totalPieces,
    totalValueMinor: record.totalValueMinor,
    currency: record.currency,
    sizesLine: sizesLine(order.sizes),
    missing: record.missing,
    dateNote: NO_DELIVERY_DATE,
  };
}

/** The order, its brand's name and one issued invoice: the one asked for, or the newest. */
export async function loadIssuedInvoice(
  client: SupabaseClient,
  admin: SupabaseClient,
  orderId: string,
  invoiceNo?: number,
): Promise<{ order: OpsOrder; brandName: string; invoice: IssuedInvoice }> {
  const { order } = await loadOrder(client, orderId);
  const [invoices, brandName] = await Promise.all([listInvoices(client, orderId), brandNameOf(admin, order.brandId)]);
  const invoice = invoiceNo === undefined ? invoices[0] : invoices.find((i) => i.invoiceNo === invoiceNo);
  if (!invoice) throw new AppError("not_found", NO_SUCH_INVOICE);
  return { order, brandName, invoice };
}
