import { formatMoney } from "@/lib/factory/pricing";
import type { HealthLine } from "@/lib/storefront/health";
import { fromPrice, sizeSpan, type ListingDraft } from "@/lib/storefront/listing";
import { StateMark } from "./parts";

/**
 * The sticky aside of the listing editor (09 screen 23 "preview + Listing health"; prototype p06): the primary
 * mockup, the title, the lowest retail price and the size span, then the health checklist, live as the form changes.
 */
export function ListingAside({ draft, sizes, image, health }: Readonly<{ draft: ListingDraft; sizes: readonly string[]; image: string | null; health: readonly HealthLine[] }>) {
  const from = fromPrice(draft.prices);
  const extra = draft.personalisation.enabled && draft.personalisation.extraMinor > 0 ? ` · names & numbers +${formatMoney(draft.personalisation.extraMinor, draft.currency)}` : "";
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-6" aria-label="Preview and listing health">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-5" aria-label="Preview">
        <div className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element -- A render made on the server or a short-lived storage link. */}
          {image ? <img src={image} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-small text-muted">No mockup yet</span>}
        </div>
        <p className="text-body font-semibold text-text">{draft.title || "Untitled listing"}</p>
        <p className="text-h3 text-text">{from === null ? "No price yet" : formatMoney(from, draft.currency)}</p>
        <p className="text-small text-muted">
          {sizeSpan(sizes, draft.prices)}
          {extra}
        </p>
      </section>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-5" aria-labelledby="listing-health">
        <h2 id="listing-health" className="text-title text-text">
          Listing health
        </h2>
        <ul className="flex flex-col gap-2" data-testid="listing-health">
          {health.map((line) => (
            <li key={line.id} className="flex items-center gap-2 text-small text-text-2" data-state={line.state}>
              <StateMark state={line.state} />
              {line.label}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
