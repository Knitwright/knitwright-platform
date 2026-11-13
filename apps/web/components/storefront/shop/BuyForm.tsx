"use client";

import type { Route } from "next";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { Notice } from "@/components/ui/Notice";
import { formatMoney } from "@/lib/factory/pricing";
import { startShopCheckoutAction } from "@/lib/storefront/actions";
import { shopPath } from "@/lib/storefront/host";
import type { Personalisation } from "@/lib/storefront/listing";
import { failureText } from "../StorefrontSettingsForm";

/**
 * BUY (spec F-L5): one size, a quantity, a name and number where the listing offers them, the shopper's email and
 * country, then the two ticks the spec asks for before payment — the size, and the returns policy. The price shown
 * is the listing's; the server prices the order again from the listing and nothing the browser sends.
 */

type Props = Readonly<{
  slug: string;
  listingId: string;
  currency: "GBP" | "AUD";
  prices: Readonly<Record<string, number>>;
  sizes: readonly string[];
  personalisation: Personalisation;
  onSale: boolean;
  closedReason: string;
}>;

const label = "text-small font-semibold text-text";

export function BuyForm({ slug, listingId, currency, prices, sizes, personalisation, onSale, closedReason }: Props) {
  const ids = { size: useId(), qty: useId(), name: useId(), number: useId(), email: useId(), country: useId() };
  const [form, setForm] = useState({ size: sizes[0] ?? "", qty: "1", name: "", number: "", email: "", country: "GB", sizeConfirmed: false, returnsAccepted: false });
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }));
  const personalised = personalisation.enabled && (form.name.trim() !== "" || form.number.trim() !== "");
  const unit = (prices[form.size] ?? 0) + (personalised ? personalisation.extraMinor : 0);
  const qty = Number.parseInt(form.qty, 10);
  const total = Number.isInteger(qty) && qty > 0 ? unit * qty : unit;

  const buy = () =>
    start(async () => {
      setProblem(null);
      const reply = await startShopCheckoutAction({ ...form, slug, listingId }).catch(() => null);
      if (!reply) return setProblem("The checkout could not be opened. Check your connection and try again.");
      if (!reply.success) return setProblem(failureText(reply.error));
      window.location.assign(reply.data.url);
    });

  if (!onSale) return <Notice tone="info">{closedReason}</Notice>;
  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); buy(); }} aria-label="Buy">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.size} className={label}>Size</label>
          <select id={ids.size} className={FIELD_CONTROL} value={form.size} onChange={(event) => set({ size: event.target.value })}>
            {sizes.map((size) => <option key={size} value={size}>{size} · {formatMoney(prices[size] ?? 0, currency)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.qty} className={label}>Quantity</label>
          <input id={ids.qty} inputMode="numeric" className={FIELD_CONTROL} value={form.qty} maxLength={2} onChange={(event) => set({ qty: event.target.value })} />
        </div>
      </div>
      {personalisation.enabled ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.name} className={label}>Name on the back (optional)</label>
            <input id={ids.name} className={FIELD_CONTROL} value={form.name} maxLength={personalisation.nameMax} placeholder={`Up to ${personalisation.nameMax} letters`} onChange={(event) => set({ name: event.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.number} className={label}>Number (optional)</label>
            <input id={ids.number} inputMode="numeric" className={FIELD_CONTROL} value={form.number} maxLength={3} placeholder={`${personalisation.numberMin}–${personalisation.numberMax}`} onChange={(event) => set({ number: event.target.value })} />
          </div>
          {personalisation.extraMinor > 0 ? <p className="col-span-2 text-caption text-muted">A name or number adds {formatMoney(personalisation.extraMinor, currency)} a piece. Personalised items cannot be returned except for defects.</p> : null}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.email} className={label}>Email</label>
          <input id={ids.email} type="email" autoComplete="email" className={FIELD_CONTROL} value={form.email} onChange={(event) => set({ email: event.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.country} className={label}>Deliver to</label>
          <select id={ids.country} className={FIELD_CONTROL} value={form.country} onChange={(event) => set({ country: event.target.value })}>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
          </select>
        </div>
      </div>
      <label className="flex items-start gap-2 text-body text-text-2">
        <input type="checkbox" className="mt-1 accent-navy" checked={form.sizeConfirmed} onChange={(event) => set({ sizeConfirmed: event.target.checked })} />
        I have checked the size chart and my size is {form.size || "chosen"}.
      </label>
      <label className="flex items-start gap-2 text-body text-text-2">
        <input type="checkbox" className="mt-1 accent-navy" checked={form.returnsAccepted} onChange={(event) => set({ returnsAccepted: event.target.checked })} />
        <span>
          I have read the <Link href={shopPath(slug, "/returns") as Route} className="text-link">returns policy</Link>.
        </span>
      </label>
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      <Button type="submit" size="lg" pending={pending} data-testid="shop-buy">
        Buy · {formatMoney(total, currency)}
      </Button>
    </form>
  );
}
