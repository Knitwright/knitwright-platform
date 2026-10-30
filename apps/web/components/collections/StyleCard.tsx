import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/factory/pricing";
import type { Style } from "@/lib/collections/types";
import { unitsOf } from "@/lib/collections/board";
import { pieces, STYLE_STATUS_LABELS } from "@/lib/collections/vocabulary";

type Props = Readonly<{
  style: Style;
  currency: string;
  /** The design's render, streamed in by the page. */
  art: ReactNode;
}>;

/**
 * One style card on the collection board (spec F-S10): the render, the name, the status, the colourway,
 * the retail price, the quantity, the sizes and the production class.
 *
 * The retail price is the RRP the founder typed, in minor units. A price nobody has set reads "No RRP
 * yet", never £0.00.
 */
export function StyleCard({ style, currency, art }: Props) {
  const planned = unitsOf(style);
  const sizes = style.sizes.filter((size) => size.qty > 0);
  return (
    <article className="flex w-60 flex-col gap-2 rounded-2xl border border-hairline bg-surface p-4" aria-label={`${style.name}, ${style.colourway === "" ? "no colourway" : style.colourway}`}>
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl bg-white/[0.03]">{art}</div>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[15px] font-medium leading-tight text-ink">{style.name}</h4>
        <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">
          {STYLE_STATUS_LABELS[style.status]}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px] text-muted">
        <dt className="sr-only">Colourway</dt>
        <dd className="col-span-2 text-ink-2">{style.colourway === "" ? "No colourway yet" : style.colourway}</dd>
        <dt>Retail</dt>
        <dd className="text-right text-ink-2">{style.rrpMinor === null ? "No RRP yet" : formatMoney(style.rrpMinor, currency)}</dd>
        <dt>Quantity</dt>
        <dd className="text-right text-ink-2">{pieces(planned)}</dd>
        <dt>Sizes</dt>
        <dd className="text-right text-ink-2">{sizes.length === 0 ? "None planned" : sizes.map((size) => size.label).join(" · ")}</dd>
        <dt>Class</dt>
        <dd className="text-right text-ink-2">{style.productionClass === null ? "Not set" : `Class ${style.productionClass}`}</dd>
      </dl>
      {style.projectId === null ? (
        <p className="text-[13px] text-faint">Not linked to a design yet.</p>
      ) : (
        <Link href={`/studio/${style.projectId}` as Route} className="soft-link text-[13px] text-cobalt-soft">
          Open the design
        </Link>
      )}
    </article>
  );
}
