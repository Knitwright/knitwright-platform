import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refusal } from "@/lib/make/service";
import { SETTINGS_COLUMNS, settingsOf } from "./settings";
import { LINE_COLUMNS, linesForDatabase, PAYMENT_COLUMNS, toLine, toPayment, type PaymentsStore } from "./store";

/**
 * The payment tables through the server's key (migration 20261228010000). Every write is one of the migration's
 * functions; a refusal the database writes for a person comes back as an AppError in its words (`refusal`). The
 * database tests cover this file (`tests/integration/payments.test.ts`).
 */

type Answer<T> = Readonly<{ data: T | null; error: Readonly<{ code?: string; hint?: string | null; message: string }> | null }>;

const must = <T>(answer: Answer<T>, missing = "That payment does not exist."): T | null => {
  if (answer.error) throw refusal(answer.error, missing);
  return answer.data;
};

export function supabaseStore(admin: SupabaseClient): PaymentsStore {
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T | null> => must<T>(await admin.rpc(fn, args));
  const onePayment = async (column: string, value: string) => {
    const row = must(await admin.from("order_payments").select(PAYMENT_COLUMNS).eq(column, value).maybeSingle());
    return row === null ? null : toPayment(row);
  };

  return {
    open: async (input) =>
      (await rpc<string>("open_order_payment", {
        p_brand_id: input.brandId,
        p_user_id: input.userId,
        p_purpose: input.purpose,
        p_method: input.method,
        p_currency: input.currency,
        p_order_value_minor: input.orderValueMinor,
        p_amount_minor: input.amountMinor,
        p_schedule: input.schedule,
        p_description: input.description,
        p_credits: input.credits,
        p_plan_id: input.planId,
        p_plan_interval: input.planInterval,
        p_lines: linesForDatabase(input.lines),
      }))!,
    attachSession: async (paymentId, provider, sessionId) => {
      await rpc("attach_payment_session", { p_payment_id: paymentId, p_provider: provider, p_session_id: sessionId });
    },
    markPaid: async (sessionId, providerPaymentId, amountMinor, currency) => {
      const answer = await admin.rpc("record_payment_paid", { p_session_id: sessionId, p_provider_payment_id: providerPaymentId, p_amount_minor: amountMinor, p_currency: currency });
      if (answer.error?.code === "P0002") return null;
      const rows = must<unknown[]>(answer) ?? [];
      return rows[0] === undefined ? null : toPayment(rows[0]);
    },
    markExpired: async (sessionId) => {
      await rpc("record_payment_expired", { p_session_id: sessionId });
    },
    payment: (id) => onePayment("id", id),
    paymentBySession: (sessionId) => onePayment("provider_session_id", sessionId),
    paymentByProviderPayment: async (providerPaymentId) => {
      const rows = must(await admin.from("order_payments").select(PAYMENT_COLUMNS).eq("provider_payment_id", providerPaymentId).limit(1)) ?? [];
      return rows[0] === undefined ? null : toPayment(rows[0]);
    },
    lines: async (paymentId) => (must(await admin.from("order_payment_lines").select(LINE_COLUMNS).eq("payment_id", paymentId).order("request_key")) ?? []).map(toLine),
    settleLine: async (lineId, status, orderId, runId, message) => {
      await rpc("settle_payment_line", { p_line_id: lineId, p_status: status, p_order_id: orderId, p_run_id: runId, p_message: message });
    },
    finish: async (paymentId) => {
      await rpc("finish_payment", { p_payment_id: paymentId });
    },
    seenEvent: async (eventId) => (must(await admin.from("payment_events").select("provider_event_id").eq("provider_event_id", eventId).maybeSingle()) ?? null) !== null,
    recordEvent: async (eventId, type) => (await rpc<boolean>("record_payment_event", { p_event_id: eventId, p_type: type })) === true,
    recordRefund: async (paymentId, amountMinor, refundId, reason, actor) =>
      (await rpc<boolean>("record_payment_refund", { p_payment_id: paymentId, p_amount_minor: amountMinor, p_provider_refund_id: refundId, p_reason: reason, p_actor: actor })) === true,
    settings: async () => settingsOf(must(await admin.from("payment_settings").select(SETTINGS_COLUMNS).eq("id", true).single())!),
    grantCredits: async (brandId, amount, key, note) => {
      await rpc("credit_grant", { p_brand_id: brandId, p_amount: amount, p_key: key, p_note: note });
    },
    recordSubscription: async (record) => {
      await rpc("record_brand_subscription", {
        p_brand_id: record.brandId,
        p_plan_id: record.planId,
        p_plan_interval: record.planInterval,
        p_status: record.status,
        p_provider: record.provider,
        p_customer_id: record.customerId,
        p_subscription_id: record.subscriptionId,
        p_current_period_end: null,
      });
    },
    updateSubscription: async (subscriptionId, status, periodEnd) => {
      await rpc("update_brand_subscription", { p_subscription_id: subscriptionId, p_status: status, p_current_period_end: periodEnd?.toISOString() ?? null });
    },
    subscription: async (subscriptionId) => {
      const row = must(await admin.from("brand_subscriptions").select("brand_id, plan_id").eq("provider_subscription_id", subscriptionId).maybeSingle()) as { brand_id: string; plan_id: string } | null;
      return row === null ? null : { brandId: row.brand_id, planId: row.plan_id };
    },
  };
}
