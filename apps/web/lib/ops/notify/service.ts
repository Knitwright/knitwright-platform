import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { EmailSender } from "@/lib/share/email";
import { throwIfQcFailed } from "../qc/errors";
import type { EmailKind, StatusMessage } from "./email";

type Admin = Pick<SupabaseClient, "rpc">;

const COLUMNS = "id, order_id, kind, to_email, subject, body, provider, sent, reason, at";

const emailRow = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  kind: z.string(),
  to_email: z.string(),
  subject: z.string(),
  body: z.string(),
  provider: z.string(),
  sent: z.boolean(),
  reason: z.string(),
  at: z.string(),
});

export interface CustomerEmail {
  readonly id: string;
  readonly orderId: string;
  readonly kind: string;
  readonly toEmail: string;
  readonly subject: string;
  readonly body: string;
  readonly provider: string;
  readonly sent: boolean;
  /** Why nothing was sent. Empty when it was. */
  readonly reason: string;
  readonly at: string;
}

export const toCustomerEmail = (data: unknown): CustomerEmail => {
  const r = emailRow.parse(data);
  return {
    id: r.id,
    orderId: r.order_id,
    kind: r.kind,
    toEmail: r.to_email,
    subject: r.subject,
    body: r.body,
    provider: r.provider,
    sent: r.sent,
    reason: r.reason,
    at: new Date(r.at).toISOString(),
  };
};

/** Every status email of an order, newest first, with the words as they went out. */
export async function listCustomerEmails(client: SupabaseClient, orderId: string): Promise<readonly CustomerEmail[]> {
  const { data, error } = await client.from("ops_customer_emails").select(COLUMNS).eq("order_id", orderId).order("at", { ascending: false }).limit(100);
  throwIfQcFailed(error);
  return (data ?? []).map(toCustomerEmail);
}

export interface EmailToSend {
  readonly orderId: string;
  readonly kind: EmailKind;
  readonly toEmail: string;
  readonly message: StatusMessage;
}

/**
 * Asks the provider, then keeps what happened either way. The record is written whether or not anything was
 * sent, so ops can always see what the customer was told, or why they were told nothing.
 */
export async function sendStatusEmail(
  admin: Admin,
  actor: string,
  input: EmailToSend,
  sender: EmailSender,
): Promise<{ id: string; sent: boolean; provider: string; reason: string }> {
  const outcome = await sender.send({ to: input.toEmail, subject: input.message.subject, body: input.message.body, replyTo: null });
  const sent = outcome.sent;
  const reason = sent ? "" : outcome.reason;
  const { data, error } = await admin.rpc("ops_record_customer_email", {
    p_actor: actor,
    p_order_id: input.orderId,
    p_kind: input.kind,
    p_to_email: input.toEmail,
    p_subject: input.message.subject,
    p_body: input.message.body,
    p_provider: sent ? outcome.provider : sender.provider,
    p_sent: sent,
    p_reason: reason,
  });
  throwIfQcFailed(error);
  const id = (Array.isArray(data) ? data[0] : data) as string | undefined;
  if (!id) throw new Error("ops_record_customer_email answered with nothing");
  return { id, sent, provider: sender.provider, reason };
}
