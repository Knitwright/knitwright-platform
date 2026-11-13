"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { cx } from "@/components/ui/cx";
import { formatMoney } from "@/lib/factory/pricing";
import { majorText, toMinor } from "@/lib/storefront/editor-state";
import { CHANNEL_LABELS, CHANNELS, type Channel, type ListingDraft } from "@/lib/storefront/listing";
import { percent, type PriceRow, type UnitCost } from "@/lib/storefront/pricing";
import { EditorCard, FieldLabel, Switch } from "./parts";

/**
 * PERSONALIZATION, PRICING AND PUBLISHING (09 screen 23; prototype p06). Pricing shows, per size, the production
 * cost from the price ladder, the seller's retail, the profit and the margin. No market price data is on file, so
 * the prototype's histogram of "similar club shirts" is not drawn: it says so instead of inventing one.
 */

type Change = (next: Partial<ListingDraft>) => void;

export function PersonalisationSection({ draft, canEdit, onChange }: Readonly<{ draft: ListingDraft; canEdit: boolean; onChange: Change }>) {
  const p = draft.personalisation;
  const ids = { name: useId(), from: useId(), to: useId(), extra: useId() };
  const set = (next: Partial<ListingDraft["personalisation"]>) => onChange({ personalisation: { ...p, ...next } });
  const whole = (value: string, fallback: number) => (/^\d{1,3}$/.test(value) ? Number(value) : fallback);
  return (
    <EditorCard id="personalization" title="Personalization" action={<Switch label="Offer names and numbers" hideLabel checked={p.enabled} disabled={!canEdit} onChange={(enabled) => set({ enabled })} />}>
      <p className="text-body text-muted">Let buyers add a name and number. We print it in your kit font, on the back, in the safe zone.</p>
      <div className={cx("grid gap-3 md:grid-cols-4", !p.enabled && "opacity-60")}>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={ids.name}>Name, most letters</FieldLabel>
          <input id={ids.name} inputMode="numeric" className={FIELD_CONTROL} value={p.nameMax} disabled={!canEdit || !p.enabled} onChange={(event) => set({ nameMax: Math.min(20, Math.max(1, whole(event.target.value, p.nameMax))) })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={ids.from}>Number from</FieldLabel>
          <input id={ids.from} inputMode="numeric" className={FIELD_CONTROL} value={p.numberMin} disabled={!canEdit || !p.enabled} onChange={(event) => set({ numberMin: whole(event.target.value, p.numberMin) })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={ids.to}>Number to</FieldLabel>
          <input id={ids.to} inputMode="numeric" className={FIELD_CONTROL} value={p.numberMax} disabled={!canEdit || !p.enabled} onChange={(event) => set({ numberMax: whole(event.target.value, p.numberMax) })} />
        </div>
        <MoneyField id={ids.extra} label="Extra price" minor={p.extraMinor} disabled={!canEdit || !p.enabled} onMinor={(extraMinor) => set({ extraMinor: extraMinor ?? 0 })} />
      </div>
    </EditorCard>
  );
}

function MoneyField({ id, label, minor, disabled, onMinor }: Readonly<{ id: string; label: string; minor: number; disabled: boolean; onMinor: (minor: number | null) => void }>) {
  const [text, setText] = useState(majorText(minor));
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input id={id} inputMode="decimal" className={FIELD_CONTROL} value={text} disabled={disabled} aria-invalid={text !== "" && toMinor(text) === null} onChange={(event) => { setText(event.target.value); onMinor(toMinor(event.target.value)); }} />
    </div>
  );
}

function RetailInput({ size, minor, disabled, onPrice }: Readonly<{ size: string; minor: number | null; disabled: boolean; onPrice: (size: string, text: string) => void }>) {
  const [text, setText] = useState(majorText(minor));
  return (
    <input
      aria-label={`Retail price for ${size}`}
      inputMode="decimal"
      className={`${FIELD_CONTROL} h-9 w-28`}
      value={text}
      disabled={disabled}
      placeholder="Not sold"
      aria-invalid={text !== "" && toMinor(text) === null}
      onChange={(event) => { setText(event.target.value); onPrice(size, event.target.value); }}
    />
  );
}

const money = (minor: number | null, currency: string): string => (minor === null ? "—" : formatMoney(minor, currency));

export function PricingSection({ rows, cost, currency, canEdit, onPrice }: Readonly<{ rows: readonly PriceRow[]; cost: UnitCost; currency: string; canEdit: boolean; onPrice: (size: string, text: string) => void }>) {
  return (
    <EditorCard id="pricing" title="Pricing">
      {rows.length === 0 ? (
        <p className="text-body text-muted">This design has no sizes yet. Add a size run in the Garment Studio, then price each size here.</p>
      ) : (
        <Table caption="Price per size">
          <thead>
            <tr><Th>Size</Th><Th>Production cost</Th><Th>Retail price</Th><Th>Profit</Th><Th>Margin</Th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.size}>
                <Td className="font-semibold">{row.size}</Td>
                <Td>{money(row.costMinor, currency)}</Td>
                <Td><RetailInput size={row.size} minor={row.retailMinor} disabled={!canEdit} onPrice={onPrice} /></Td>
                <Td className={row.profitMinor !== null && row.profitMinor <= 0 ? "text-bad" : "font-semibold text-ok"}>{money(row.profitMinor, currency)}</Td>
                <Td>{percent(row.marginBp)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="text-small text-muted">
        {cost.status === "priced" ? cost.label : cost.reason} Production cost includes printing. Shipping is charged separately. No market prices for similar products are on file yet, so none are
        shown.
      </p>
    </EditorCard>
  );
}

const CHANNEL_LINES: Readonly<Record<Channel, string>> = {
  storefront: "Your own shop at your-brand.knitwright.com. Buyers pay by card; made-to-order sales join the weekly batch.",
  shopify: "Sync title, description, mockups, prices and sizes to your Shopify store. Connect it under Sales channels.",
  team_store: "Players order and pay their own sizes; one batch ships to the club.",
};

export function PublishingSection({ draft, canEdit, fabrics, onChange }: Readonly<{ draft: ListingDraft; canEdit: boolean; fabrics: readonly string[]; onChange: Change }>) {
  const fabricId = useId();
  return (
    <EditorCard id="publishing" title="Publishing">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Where it is sold</legend>
        {CHANNELS.map((channel) => (
          <label key={channel} className={cx("flex cursor-pointer gap-3 rounded-lg p-4", draft.channel === channel ? "bg-soft-2" : "bg-soft")}>
            <input type="radio" name="channel" className="mt-1 size-4 accent-navy" checked={draft.channel === channel} disabled={!canEdit} onChange={() => onChange({ channel })} />
            <span className="flex flex-col gap-1">
              <span className="text-body font-semibold text-text">{CHANNEL_LABELS[channel]}</span>
              <span className="text-small text-muted">{CHANNEL_LINES[channel]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-semibold text-text">How it sells</legend>
        <div className="flex flex-wrap gap-4 text-body text-text-2">
          <label className="flex items-center gap-2"><input type="radio" name="mode" className="accent-navy" checked={draft.mode === "made_to_order"} disabled={!canEdit} onChange={() => onChange({ mode: "made_to_order" })} />Made to order (weekly batch)</label>
          <label className="flex items-center gap-2"><input type="radio" name="mode" className="accent-navy" checked={draft.mode === "drop"} disabled={!canEdit} onChange={() => onChange({ mode: "drop" })} />Pre-order in a drop</label>
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={fabricId}>Fabric</FieldLabel>
        <select id={fabricId} className={FIELD_CONTROL} value={draft.fabricKey ?? ""} disabled={!canEdit} onChange={(event) => onChange({ fabricKey: event.target.value || null })}>
          <option value="">Choose a fabric</option>
          {fabrics.map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-4 text-body text-text-2">
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-navy" checked={draft.hideUntilReady} disabled={!canEdit} onChange={(event) => onChange({ hideUntilReady: event.target.checked })} />Hide in store until ready</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-navy" checked={draft.syncMockups} disabled={!canEdit} onChange={(event) => onChange({ syncMockups: event.target.checked })} />Sync mockups</label>
      </div>
      <Link href="/store" className="text-small text-link">Connect another sales channel</Link>
    </EditorCard>
  );
}
