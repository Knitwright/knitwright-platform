"use client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/SelectField";
import { recordFactoryDepositAction, refundPaymentAction, savePaymentSettingsAction } from "@/lib/payments/actions";
import { bpsFromPercent, minorFromText } from "@/lib/payments/amounts";
import type { PaymentSettings } from "@/lib/payments/settings";
import { text, useSubmit } from "./useSubmit";

/**
 * The ops finance page's forms (plan v6 C1, decision 0152; F-G4): record a factory deposit (the database refuses
 * one over the headroom), change the refund reserve and the deposit rule, and refund a card payment.
 */

const CURRENCIES = [
  { id: "GBP", label: "GBP" },
  { id: "AUD", label: "AUD" },
];

const Said = ({ note }: Readonly<{ note: Readonly<{ tone: "ok" | "warn"; text: string }> | null }>) =>
  note ? (
    <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
      {note.text}
    </Notice>
  ) : null;

export function DepositForm() {
  const { pending, note, onSubmit } = useSubmit(
    (form) => {
      const amountMinor = minorFromText(text(form, "amount"));
      if (amountMinor === null) return "Type the amount, such as 1250.00.";
      if (text(form, "note") === "" || text(form, "factory") === "") return "Name the factory and say what the deposit is for.";
      return { factoryProfileId: text(form, "factory"), currency: text(form, "currency") as "GBP" | "AUD", amountMinor, note: text(form, "note") };
    },
    recordFactoryDepositAction,
    "Deposit recorded.",
  );
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-2" data-testid="deposit-form">
      <Field name="factory" label="Factory profile" defaultValue="knitwright-default" maxLength={120} hint="The id on the Factories page." />
      <SelectField name="currency" label="Currency" options={CURRENCIES} />
      <Field name="amount" label="Amount" inputMode="decimal" placeholder="1250.00" />
      <Field name="note" label="What it is for" maxLength={300} />
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Said note={note} />
        <div>
          <Button type="submit" pending={pending}>
            Record the deposit
          </Button>
        </div>
      </div>
    </form>
  );
}

const optionalMinor = (value: string): number | null | "bad" => (value === "" ? null : (minorFromText(value) ?? "bad"));

export function PaymentSettingsForm({ settings }: Readonly<{ settings: PaymentSettings }>) {
  const { pending, note, onSubmit } = useSubmit(
    (form) => {
      const refundReserveBps = bpsFromPercent(text(form, "reserve"));
      const depositBps = bpsFromPercent(text(form, "deposit"));
      const gbp = optionalMinor(text(form, "gbp"));
      const aud = optionalMinor(text(form, "aud"));
      if (refundReserveBps === null) return "The refund reserve is a percentage from 0 to 100.";
      if (depositBps === null || depositBps < 1 || depositBps > 9999) return "The deposit is a percentage above 0 and below 100.";
      if (gbp === "bad" || aud === "bad") return "A threshold is an amount, such as 2000.00, or empty for none.";
      return { refundReserveBps, depositBps, depositThresholdGbpMinor: gbp, depositThresholdAudMinor: aud, unpricedOrders: text(form, "unpriced") as "invoice" | "refuse", label: text(form, "label") || "Set by ops" };
    },
    savePaymentSettingsAction,
    "Saved. New checkouts use these settings.",
  );
  const threshold = (minor: number | null): string => (minor === null ? "" : (minor / 100).toFixed(2));
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-2" data-testid="payment-settings-form">
      <Field name="reserve" label="Refund reserve, % of open pre-orders" inputMode="decimal" defaultValue={String(settings.refundReserveBps / 100)} />
      <Field name="deposit" label="Deposit paid at checkout, %" inputMode="decimal" defaultValue={String(settings.depositBps / 100)} />
      <Field name="gbp" label="A deposit is allowed over (GBP)" inputMode="decimal" defaultValue={threshold(settings.depositThresholdMinor.GBP)} hint="Empty: no deposits in GBP." />
      <Field name="aud" label="A deposit is allowed over (AUD)" inputMode="decimal" defaultValue={threshold(settings.depositThresholdMinor.AUD)} hint="Empty: no deposits in AUD." />
      <SelectField
        name="unpriced"
        label="An order with no price on file"
        defaultValue={settings.unpricedOrders}
        options={[
          { id: "invoice", label: "Send it, and Knitwright invoices it" },
          { id: "refuse", label: "Refuse it until a price is set" },
        ]}
      />
      <Field name="label" label="Where these numbers come from" defaultValue={settings.isPlaceholder ? "" : settings.label} maxLength={300} />
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Said note={note} />
        <div>
          <Button type="submit" pending={pending}>
            Save payment settings
          </Button>
        </div>
      </div>
    </form>
  );
}

export function RefundForm({ paymentId, leftMinor }: Readonly<{ paymentId: string; leftMinor: number }>) {
  const { pending, note, onSubmit } = useSubmit(
    (form) => {
      const amountMinor = minorFromText(text(form, "amount"));
      if (amountMinor === null || amountMinor > leftMinor) return "Type an amount up to what is left of the charge.";
      if (text(form, "reason") === "") return "Say why it is refunded.";
      return { paymentId, amountMinor, reason: text(form, "reason") };
    },
    refundPaymentAction,
    "Refunded.",
  );
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2">
      <Field name="amount" label="Refund" inputMode="decimal" defaultValue={(leftMinor / 100).toFixed(2)} />
      <Field name="reason" label="Why" maxLength={300} />
      <Button type="submit" size="sm" variant="secondary" pending={pending}>
        Refund
      </Button>
      <Said note={note} />
    </form>
  );
}
