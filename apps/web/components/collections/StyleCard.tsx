import { garmentEditorHref } from "@/lib/canvas/address";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/ui/Chips";
import { formatMoney } from "@/lib/factory/pricing";
import type { Style } from "@/lib/collections/types";
import { unitsOf } from "@/lib/collections/board";
import { pieces, STYLE_STATUS_LABELS, type StyleStatus } from "@/lib/collections/vocabulary";
import type { StyleFacts } from "@/lib/order-desk/plan-cards";
import { RemoveStyle } from "./RemoveStyle";

type Props = Readonly<{
  style: Style;
  collectionId: string;
  currency: string;
  /** Fabric, MOQ and target cost, worked out by the page from the tiers and the line plan. */
  facts: StyleFacts;
  /** Owners, admins and kit managers may take a style out of the plan; everyone else only reads it. */
  canEdit: boolean;
  /** The design's render, streamed in by the page. */
  art: ReactNode;
}>;

const TONES: Readonly<Record<StyleStatus, "ok" | "warn" | "neutral" | "info">> = { draft: "neutral", sampling: "warn", approved: "ok", ordered: "info" };

/**
 * One style card on the range plan board (09 screen 32, p13; spec F-S10): the status and the render
 * over an attribute table of style, colourway, fabric, quantity, target cost, MOQ, RRP, sizes and
 * production class. A value nobody has set reads as such, never £0.00.
 */
export function StyleCard({ style, collectionId, currency, facts, canEdit, art }: Props) {
  const sizes = style.sizes.filter((size) => size.qty > 0);
  const rows: readonly (readonly [string, string])[] = [
    ["Style", style.name],
    ["Colourway", style.colourway === "" ? "No colourway yet" : style.colourway],
    ["Fabric", facts.fabric],
    ["Quantity", pieces(unitsOf(style))],
    ["Target cost", facts.targetCost],
    ["MOQ", facts.moq],
    ["RRP", style.rrpMinor === null ? "No RRP yet" : formatMoney(style.rrpMinor, currency)],
    ["Sizes", sizes.length === 0 ? "None planned" : sizes.map((size) => size.label).join(" · ")],
    ["Class", style.productionClass === null ? "Not set" : `Class ${style.productionClass}`],
  ];
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-bg" aria-label={`${style.name}, ${style.colourway === "" ? "no colourway" : style.colourway}`}>
      <div className="relative flex h-40 items-center justify-center bg-soft">
        <StatusPill tone={TONES[style.status]} className="absolute top-3 left-3">
          {STYLE_STATUS_LABELS[style.status]}
        </StatusPill>
        {art}
      </div>
      <dl className="divide-y divide-border text-small">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-2 gap-2 px-3 py-1.5">
            <dt className="text-muted">{label}</dt>
            <dd className="truncate font-medium text-text" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1 border-t border-border px-3 py-2 text-small">
        {style.projectId === null ? (
          <p className="text-muted">Not linked to a design yet.</p>
        ) : (
          <Link href={garmentEditorHref(style.projectId)} className="text-link">
            Open the design
          </Link>
        )}
        {canEdit ? <RemoveStyle collectionId={collectionId} styleId={style.id} name={style.name} /> : null}
      </div>
    </article>
  );
}
