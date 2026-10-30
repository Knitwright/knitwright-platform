"use client";

import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/Button";
import {
  HANDOFF_LABEL,
  HANDOFF_NOTE,
  NAMES_COST_NOTE,
  PATTERN_COST_NOTE,
  type KitPartId,
  type KitPrice,
} from "@/lib/teamwear";

/**
 * The sticky footer of spec F-T1: the quantity stepper for the part showing, the price for each
 * piece with the tier's discount badge, the kit total, and the three actions.
 *
 * The last action is a hand-off, not an Add to cart: Knitwright shows the price and the delivery and
 * hands the order to the Store, which is where money is taken (owner decision 1). The words beside
 * the button say so every time.
 */

export type StickyFooterProps = Readonly<{
  price: KitPrice;
  part: KitPartId;
  partLabel: string;
  quantity: number;
  floor: number;
  onQuantity: (quantity: number) => void;
  namesNumbers: boolean;
  /** Where "Design in Studio" goes, or null while the kit has not been saved. */
  studioHref: string | null;
  onSave: () => void;
  /** Saves the kit and opens the Studio editor on it, for a kit nobody has saved yet. */
  onStudio: () => void;
  saving: boolean;
  onQuote: () => void;
  /** What the quote seam said, or null while nobody has asked for one. */
  quoteNote: string | null;
  onHandoff: () => void;
  /** The hand-off reference, or the reason there is none. */
  handoffNote: string | null;
}>;

const STEP = "flex size-11 items-center justify-center rounded-full border border-white/20 text-xl text-ink disabled:opacity-40";

export function StickyFooter(props: StickyFooterProps) {
  const { price, quantity, floor } = props;
  const line = price.parts.find((entry) => entry.partId === props.part);
  return (
    <section
      className="sticky bottom-0 z-40 flex flex-col gap-3 border-t border-white/15 bg-[#0c0f14]/95 p-3 backdrop-blur-md lg:rounded-b-2xl"
      aria-label="Quantity and price"
      data-testid="teamwear-footer"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2" data-testid="teamwear-stepper">
          <button type="button" onClick={() => props.onQuantity(quantity - 1)} disabled={quantity <= floor} className={STEP} aria-label={`One fewer ${props.partLabel.toLowerCase()}`}>
            <span aria-hidden="true">−</span>
          </button>
          <label className="flex flex-col text-xs text-muted">
            <span className="sr-only">{props.partLabel}, how many</span>
            <input
              type="number"
              min={floor}
              step={1}
              value={quantity}
              onChange={(event) => props.onQuantity(Number(event.target.value))}
              className="h-11 w-20 rounded-xl border border-white/20 bg-black/20 text-center text-[15px] text-ink"
              data-testid="teamwear-quantity"
            />
          </label>
          <button type="button" onClick={() => props.onQuantity(quantity + 1)} className={STEP} aria-label={`One more ${props.partLabel.toLowerCase()}`}>
            <span aria-hidden="true">＋</span>
          </button>
          <span className="text-xs text-muted">{props.partLabel}, smallest order {floor}</span>
        </div>

        <p className="flex items-baseline gap-2" data-testid="teamwear-unit-price">
          <span className="text-[17px] text-ink">{line ? line.unit : "Not priced yet"}</span>
          <span className="text-xs text-muted">each</span>
          {line?.discount === null || line === undefined ? null : (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs text-ink" data-testid="teamwear-discount">
              {line.discount}
            </span>
          )}
        </p>

        <p className="text-[17px] text-ink" data-testid="teamwear-total">
          Total {price.total}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={props.onSave} pending={props.saving} data-testid="teamwear-save">
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={props.onQuote} data-testid="teamwear-quote">
          Quote
        </Button>
        {props.studioHref === null ? (
          <Button type="button" variant="secondary" onClick={props.onStudio} pending={props.saving} data-testid="teamwear-studio">
            Design in Studio
          </Button>
        ) : (
          <Link
            href={props.studioHref as Route}
            className="inline-flex h-11 items-center rounded-full border border-white/20 px-5 text-[15px] text-ink no-underline"
            data-testid="teamwear-studio"
          >
            Design in Studio
          </Link>
        )}
        <Button type="button" onClick={props.onHandoff} data-testid="teamwear-handoff">
          {HANDOFF_LABEL}
        </Button>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted">
        <p>{HANDOFF_NOTE}</p>
        {price.totalNote === null ? null : <p data-testid="teamwear-total-note">{price.totalNote}</p>}
        {price.factoryName === null ? null : <p>Prices from {price.factoryName}. {line?.tierLabel ?? ""}</p>}
        <p>{PATTERN_COST_NOTE}</p>
        {props.namesNumbers ? <p data-testid="teamwear-names-cost">{NAMES_COST_NOTE}</p> : null}
        {props.quoteNote === null ? null : <p data-testid="teamwear-quote-note">{props.quoteNote}</p>}
        {props.handoffNote === null ? null : <p data-testid="teamwear-handoff-note">{props.handoffNote}</p>}
      </div>
    </section>
  );
}
