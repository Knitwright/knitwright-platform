import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { throwIfQcFailed } from "../qc/errors";
import { linesForRecord, type InvoiceLine, type InvoiceModel } from "./model";

type Admin = Pick<SupabaseClient, "rpc">;

const COLUMNS =
  "id, order_id, invoice_no, replaces_id, issued_on, origin_country, destination_country, preference_scheme, incoterms, lines, total_pieces, total_value_minor, currency, missing, rule_id, at";

const line = z.object({
  description: z.string(),
  hsCode: z.string().nullable(),
  originCountry: z.string(),
  pieces: z.number().int(),
  unitValueMinor: z.number().int().nullable(),
  lineValueMinor: z.number().int().nullable(),
});

const invoiceRow = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  invoice_no: z.number().int(),
  replaces_id: z.uuid().nullable(),
  issued_on: z.string(),
  origin_country: z.string(),
  destination_country: z.string(),
  preference_scheme: z.string().nullable(),
  incoterms: z.string(),
  lines: z.array(line),
  total_pieces: z.number().int(),
  total_value_minor: z.number().int().nullable(),
  currency: z.string().nullable(),
  missing: z.array(z.string()),
  rule_id: z.string(),
  at: z.string(),
});

export interface IssuedInvoice {
  readonly id: string;
  readonly orderId: string;
  readonly invoiceNo: number;
  /** The invoice this one corrects, when it corrects one. An invoice is never edited. */
  readonly replacesId: string | null;
  readonly issuedOn: string;
  readonly originCountry: string;
  readonly destinationCountry: string;
  readonly preferenceScheme: string | null;
  readonly incoterms: string;
  readonly lines: readonly InvoiceLine[];
  readonly totalPieces: number;
  readonly totalValueMinor: number | null;
  readonly currency: string | null;
  readonly missing: readonly string[];
  readonly ruleId: string;
  readonly at: string;
}

export const toIssuedInvoice = (data: unknown): IssuedInvoice => {
  const r = invoiceRow.parse(data);
  return {
    id: r.id,
    orderId: r.order_id,
    invoiceNo: r.invoice_no,
    replacesId: r.replaces_id,
    issuedOn: r.issued_on,
    originCountry: r.origin_country,
    destinationCountry: r.destination_country,
    preferenceScheme: r.preference_scheme,
    incoterms: r.incoterms,
    lines: r.lines,
    totalPieces: r.total_pieces,
    totalValueMinor: r.total_value_minor,
    currency: r.currency,
    missing: r.missing,
    ruleId: r.rule_id,
    at: new Date(r.at).toISOString(),
  };
};

/** Every invoice issued for an order, newest first. The newest is the one in force. */
export async function listInvoices(client: SupabaseClient, orderId: string): Promise<readonly IssuedInvoice[]> {
  const { data, error } = await client.from("ops_commercial_invoices").select(COLUMNS).eq("order_id", orderId).order("invoice_no", { ascending: false }).limit(50);
  throwIfQcFailed(error);
  return (data ?? []).map(toIssuedInvoice);
}

/** Issues an invoice. Append-only: a correction names the invoice it replaces and gets its own number. */
export async function issueInvoice(
  admin: Admin,
  actor: string,
  invoice: InvoiceModel,
  options: Readonly<{ replacesId?: string | null; ruleId?: string }> = {},
): Promise<{ id: string; invoiceNo: number }> {
  const { data, error } = await admin.rpc("ops_issue_commercial_invoice", {
    p_actor: actor,
    p_order_id: invoice.orderId,
    p_issued_on: invoice.issuedOn,
    p_origin_country: invoice.originCountry,
    p_destination_country: invoice.destinationCountry,
    p_lines: linesForRecord(invoice),
    p_missing: invoice.missing,
    p_preference_scheme: invoice.preferenceScheme,
    p_incoterms: invoice.incoterms,
    p_replaces_id: options.replacesId ?? null,
    p_rule_id: options.ruleId ?? "R-GAP-000",
  });
  throwIfQcFailed(error);
  const row = (Array.isArray(data) ? data[0] : data) as { invoice_id: string; invoice_no: number } | undefined;
  if (!row) throw new Error("ops_issue_commercial_invoice answered with nothing");
  return { id: row.invoice_id, invoiceNo: row.invoice_no };
}
