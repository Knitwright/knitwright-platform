"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { selectSizesAction } from "@/lib/make/actions";
import {
  chipsFor,
  describeTotal,
  filterProducts,
  lineKey,
  priceSelection,
  type ChipId,
  type OrderProduct,
  type Quantities,
} from "@/lib/make/order-modal";
import type { SellCurrency } from "@/lib/factory/schemas";

type Props = Readonly<{ products: readonly OrderProduct[]; currency: SellCurrency; canOrder: boolean; deliveryText: string }>;
type Note = Readonly<{ tone: "ok" | "warn"; text: string }>;

const newKey = (): string => crypto.randomUUID();

/**
 * "Select sizes" (F-S7): search across your own products, filter by class or by a date the factory data can give,
 * and type the pieces you want for each size. The tier price is read across every piece in the basket, so it
 * changes as the quantities do (spec F-T5).
 *
 * The footer shows the pieces, the total where every line has a price, and the delivery date. There is no
 * checkout: the button hands the order over to production (owner decision 1).
 */
export function SelectSizes({ products, currency, canOrder, deliveryText }: Props) {
  const router = useRouter();
  const searchId = useId();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<ChipId>("all");
  const [typed, setTyped] = useState<Quantities>({});
  const [requestKey, setRequestKey] = useState(newKey);
  const [note, setNote] = useState<Note | null>(null);

  const chips = useMemo(() => chipsFor(products), [products]);
  const shown = useMemo(() => filterProducts(products, query, chip), [products, query, chip]);
  const selection = useMemo(() => priceSelection(products, typed, currency), [products, typed, currency]);

  const set = (productId: string, size: string, value: string) => {
    setNote(null);
    setTyped((now) => ({ ...now, [lineKey(productId, size)]: value }));
  };

  const send = () => {
    const lines = selection.products.flatMap((part) => part.rows.filter((row) => row.qty > 0).map((row) => ({ productId: row.productId, size: row.size, pieces: row.qty })));
    if (lines.length === 0) return setNote({ tone: "warn", text: "Type the pieces you want first." });
    start(async () => {
      const reply = await selectSizesAction({ lines, requestKey }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The order could not be sent. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: `Sent to production: ${reply.data.sent.length} order${reply.data.sent.length === 1 ? "" : "s"}, waiting for the next cut-off.` });
      setTyped({});
      setRequestKey(newKey());
      router.refresh();
    });
  };

  if (!canOrder) return <p className="text-sm text-muted">Only owners, admins and kit managers can place orders.</p>;

  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); send(); }}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className="text-sm font-medium text-ink">Search my products</label>
        <input id={searchId} className={FIELD_CONTROL} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, article code or colourway" />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter the products">
        {chips.map((one) => (
          <button
            key={one.id}
            type="button"
            aria-pressed={chip === one.id}
            disabled={!one.available && one.id !== "all"}
            onClick={() => setChip(one.id)}
            className={`rounded-full border px-4 py-2 text-sm ${chip === one.id ? "border-cobalt-soft text-ink" : "border-hairline text-muted"} disabled:opacity-55`}
          >
            {one.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? <Notice>No product matches that.</Notice> : null}

      <div className="flex flex-col gap-4">
        {shown.map((product) => {
          const part = selection.products.find((one) => one.product.productId === product.productId);
          return (
            <section key={product.productId} aria-labelledby={`product-${product.productId}`} className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-5">
              <h3 id={`product-${product.productId}`} className="text-[15px] font-medium text-ink">
                {product.name} · {product.articleCode ?? "no base article yet"} · {product.colourway}
              </h3>
              <p className="text-sm text-muted">{product.madeBy}</p>
              <p className="text-sm text-muted">
                Class {product.productionClass ?? "not set"} · {product.readyBy === null ? "no delivery date yet" : `could be delivered ${product.readyBy}`}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {part?.rows.map((row) => (
                  <div key={row.size} className="flex flex-col gap-1">
                    <label htmlFor={`${product.productId}-${row.size}`} className="text-sm text-ink">{`Size ${row.size}`}</label>
                    <input
                      id={`${product.productId}-${row.size}`}
                      inputMode="numeric"
                      className={FIELD_CONTROL}
                      value={typed[lineKey(product.productId, row.size)] ?? ""}
                      onChange={(event) => set(product.productId, row.size, event.target.value)}
                      placeholder="0"
                    />
                    <span className="text-sm text-faint">{row.unitText}</span>
                  </div>
                ))}
                {product.sizes.length === 0 ? <p className="text-sm text-muted">This design has no size run yet.</p> : null}
              </div>
              {part && part.check.findings.length > 0 && part.pieces > 0 ? (
                <Notice tone="warn">{part.check.findings.map((found) => `${found.message} (${found.ruleId})`).join(" ")}</Notice>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 text-[15px]" aria-live="polite">
        <p className="text-ink">{describeTotal(selection)}</p>
        <p className="text-muted">{deliveryText}</p>
      </div>

      {note ? <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>{note.text}</Notice> : null}

      <div>
        <Button type="submit" pending={pending} disabled={!selection.canSend}>Hand this order to production</Button>
      </div>
    </form>
  );
}
