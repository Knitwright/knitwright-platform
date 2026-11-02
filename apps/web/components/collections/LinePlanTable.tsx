"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { formatMoney } from "@/lib/factory/pricing";
import { linePlan, type LineRow } from "@/lib/collections/line-plan";
import type { CollectionPlan, PricingByStyle, Style } from "@/lib/collections/types";
import { LINE_PLAN_COLUMNS, SELL_THROUGH, splitText, UNIT_COST_IS, percent, pieces } from "@/lib/collections/vocabulary";
import { saveStyleAction } from "@/lib/collections/actions";

type Props = Readonly<{ plan: CollectionPlan; pricing: PricingByStyle; canEdit: boolean }>;
type Typed = Readonly<Record<string, string>>;
type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

const keyOf = (styleId: string, size: string): string => `${styleId}:${size}`;

const typedOf = (plan: CollectionPlan): Typed =>
  Object.fromEntries(plan.styles.flatMap((style) => style.sizes.map((size) => [keyOf(style.id, size.label), String(size.qty)])));

const whole = (text: string): number => {
  const value = Number(text);
  return Number.isInteger(value) && value >= 0 && value <= 999_999 ? value : 0;
};

/** The plan as the typed quantities make it, so every figure below is priced from what is on screen. */
const planAsTyped = (plan: CollectionPlan, typed: Typed): CollectionPlan => ({
  ...plan,
  styles: plan.styles.map((style) => ({
    ...style,
    sizes: style.sizes.map((size) => ({ label: size.label, qty: whole(typed[keyOf(style.id, size.label)] ?? String(size.qty)) })),
  })),
});

const money = (minor: number | null, currency: string): string => (minor === null ? "—" : formatMoney(minor, currency));

/**
 * The line plan (spec F-S10): a row per style, expandable into its size rows, priced from the factory
 * tiers at the whole plan's quantity with freight and duty on top, and a footer of totals.
 *
 * Changing a quantity re-prices every line as you type, because the table is drawn from the same pure
 * functions the server uses: the tier is read again at the plan's new total, so one more piece can move
 * the whole plan to the next tier in front of you. That is the acceptance test of F-S10.
 */
export function LinePlanTable({ plan, pricing, canEdit }: Props) {
  const ids = { table: useId(), sellThrough: useId() };
  const [typed, setTyped] = useState<Typed>(() => typedOf(plan));
  const [open, setOpen] = useState<readonly string[]>([]);
  const [sellThrough, setSellThrough] = useState(true);
  const [note, setNote] = useState<Note | null>(null);
  const [pending, start] = useTransition();

  const { rows, totals } = useMemo(() => linePlan(planAsTyped(plan, typed), pricing), [plan, pricing, typed]);
  const currency = plan.currency;

  const save = (style: Style) => {
    start(async () => {
      const sizes = Object.fromEntries(style.sizes.map((size) => [size.label, whole(typed[keyOf(style.id, size.label)] ?? String(size.qty))]));
      const reply = await saveStyleAction({
        collectionId: plan.id,
        styleId: style.id,
        frameId: style.frameId,
        productId: style.productId,
        name: style.name,
        status: style.status,
        colourway: style.colourway,
        articleCode: style.articleCode,
        fabricCode: style.fabricCode,
        productionClass: style.productionClass,
        wholesaleMinor: style.wholesaleMinor,
        rrpMinor: style.rrpMinor,
        wholesaleSplitBp: style.wholesaleSplitBp,
        sizes,
        x: style.x,
        y: style.y,
      }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The quantities could not be saved. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: `Saved the quantities of ${style.name}.` });
    });
  };

  return (
    <section aria-labelledby={ids.table} className="flex flex-col gap-4">
      <h2 id={ids.table} className="text-xl font-medium text-ink">
        Line plan
      </h2>
      <p className="max-w-3xl text-[13px] leading-relaxed text-muted">{UNIT_COST_IS}</p>

      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full min-w-[60rem] text-left text-[14px]">
          <caption className="sr-only">The line plan of {plan.name}</caption>
          <thead>
            <tr className="border-b border-hairline text-[13px] text-muted">
              <th scope="col" className="w-10 px-3 py-3" />
              {LINE_PLAN_COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-3 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => {
              const style = plan.styles.find((one) => one.id === row.styleId)!;
              const expanded = open.includes(row.styleId);
              return (
                <Row
                  key={row.styleId}
                  row={row}
                  style={style}
                  currency={currency}
                  expanded={expanded}
                  canEdit={canEdit}
                  pending={pending}
                  sellThrough={sellThrough}
                  typed={typed}
                  onToggle={() => setOpen((now) => (now.includes(row.styleId) ? now.filter((id) => id !== row.styleId) : [...now, row.styleId]))}
                  onType={(size, value) => setTyped((now) => ({ ...now, [keyOf(row.styleId, size)]: value }))}
                  onSave={() => save(style)}
                />
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={LINE_PLAN_COLUMNS.length + 1} className="px-3 py-6 text-[15px] text-muted">
                  No styles in this plan yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-5">
        <h3 className="text-base font-medium text-ink">Totals</h3>
        <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-3">
          <Figure label="Total units" value={pieces(totals.units)} />
          <Figure label="Production cost, landed" value={money(totals.landedCostMinor, currency)} />
          <Figure label="Of which freight and duty" value={money(totals.freightMinor === null || totals.dutyMinor === null ? null : totals.freightMinor + totals.dutyMinor, currency)} />
          <Figure label="Wholesale revenue" value={sellThrough ? money(totals.wholesaleRevenueMinor, currency) : "—"} />
          <Figure label="D2C revenue" value={sellThrough ? money(totals.d2cRevenueMinor, currency) : "—"} />
          <Figure label="Blended profit" value={sellThrough ? money(totals.profitMinor, currency) : "—"} />
          <Figure label="Blended margin" value={sellThrough && totals.marginBp !== null ? `${percent(totals.marginBp)}%` : "—"} />
        </dl>
        <label htmlFor={ids.sellThrough} className="flex items-center gap-2 text-[14px] text-ink">
          <input id={ids.sellThrough} type="checkbox" className="size-4" checked={sellThrough} onChange={(event) => setSellThrough(event.target.checked)} />
          {SELL_THROUGH}
        </label>
        {sellThrough ? null : (
          <p className="text-[13px] text-muted">
            Revenue, profit and margin are hidden: no sell-through rate is on file (R-GAP-000), so the only honest figure is the
            full-price one above.
          </p>
        )}
        {totals.notes.length > 0 ? (
          <ul className="flex flex-col gap-1 text-[13px] text-muted">
            {totals.notes.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        ) : null}
        {totals.labels.length > 0 ? <p className="text-[13px] text-faint">Figures from: {totals.labels.join(" · ")}</p> : null}
      </div>

      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
    </section>
  );
}

function Figure({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:gap-0.5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

type RowProps = Readonly<{
  row: LineRow;
  style: Style;
  currency: string;
  expanded: boolean;
  canEdit: boolean;
  pending: boolean;
  sellThrough: boolean;
  typed: Typed;
  onToggle: () => void;
  onType: (size: string, value: string) => void;
  onSave: () => void;
}>;

/** One style's row, and its size rows when it is open. */
function Row({ row, style, currency, expanded, canEdit, pending, sellThrough, typed, onToggle, onType, onSave }: RowProps) {
  const unit = row.cost.status === "landed" ? formatMoney(row.cost.unitMinor, currency) : row.cost.reason;
  return (
    <>
      <tr>
        <td className="px-3 py-3">
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="soft-link text-muted">
            <span aria-hidden="true">{expanded ? "−" : "+"}</span>
            <span className="sr-only">{expanded ? `Hide the sizes of ${row.name}` : `Show the sizes of ${row.name}`}</span>
          </button>
        </td>
        <th scope="row" className="px-3 py-3 font-medium text-ink">
          {row.name}
          <span className="block text-[13px] font-normal text-muted">{row.colourway === "" ? "No colourway yet" : row.colourway}</span>
        </th>
        <td className="px-3 py-3 text-muted">{row.group ?? "Not in a group"}</td>
        <td className="px-3 py-3 text-muted">{row.status}</td>
        <td className="px-3 py-3 text-muted">{row.colourways}</td>
        <td className="px-3 py-3 text-muted">{row.fabricCode ?? "Not chosen"}</td>
        <td className="px-3 py-3 text-ink">{row.qty}</td>
        <td className="px-3 py-3 text-muted">
          {splitText(row.wholesaleSplitBp)}
          <span className="block text-[13px]">
            {row.wholesaleUnits} / {row.d2cUnits}
          </span>
        </td>
        <td className="px-3 py-3 text-ink">{unit}</td>
        <td className="px-3 py-3 text-muted">{row.wholesaleMinor === null ? "Not set" : formatMoney(row.wholesaleMinor, currency)}</td>
        <td className="px-3 py-3 text-muted">{row.rrpMinor === null ? "Not set" : formatMoney(row.rrpMinor, currency)}</td>
        <td className="px-3 py-3 text-muted">{sellThrough && row.marginBp !== null ? `${percent(row.marginBp)}%` : "—"}</td>
      </tr>
      {expanded ? (
        <tr>
          <td />
          <td colSpan={LINE_PLAN_COLUMNS.length} className="px-3 pb-4">
            <div className="flex flex-col gap-3">
              {style.sizes.length === 0 ? (
                <p className="text-[13px] text-muted">No sizes planned for {row.name} yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-3">
                  {row.sizes.map((size) => (
                    <li key={size.label} className="flex flex-col gap-1">
                      <label className="text-[13px] text-muted" htmlFor={`${row.styleId}-${size.label}`}>
                        {size.label}
                      </label>
                      <input
                        id={`${row.styleId}-${size.label}`}
                        inputMode="numeric"
                        className={`${FIELD_CONTROL} w-24`}
                        value={typed[`${row.styleId}:${size.label}`] ?? String(size.qty)}
                        onChange={(event) => onType(size.label, event.target.value)}
                        disabled={!canEdit}
                      />
                      <span className="text-[13px] text-faint">{size.landedMinor === null ? "No price" : formatMoney(size.landedMinor, currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && style.sizes.length > 0 ? (
                <div>
                  <Button type="button" variant="secondary" pending={pending} onClick={onSave}>
                    Save these quantities
                  </Button>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
