import { WhyLink } from "@/components/rulebook/WhyLink";
import type { MarketSummary } from "@/lib/markets/view";

/**
 * What choosing a market means, beside the selector that chose it (spec F-S8; plan v5 O3, decision
 * 0103): the currency, the tax treatment, the label lines a garment sold there may carry, what is
 * still missing before a date can be promised, and the market row's own label.
 *
 * Nothing here is a figure of its own. Every line is read from `lib/markets`, which reads the market's
 * row, and every gap carries the rule that explains it.
 */

const PANEL = "glass flex flex-col gap-3 rounded-[1.75rem] p-5 sm:p-6";
const HEADING = "text-lg font-medium tracking-[-0.01em] text-ink";

const TAX_TONE = { charged: "text-ink-2", "not-registered": "text-warn", "not-recorded": "text-warn" } as const;

export function MarketPanel({ summary }: Readonly<{ summary: MarketSummary }>) {
  const { market, countryName, countryPhrase, currency, tax, labelLines, gaps } = summary;
  return (
    <section aria-labelledby="market" className={PANEL}>
      <h2 id="market" className={HEADING}>
        {`Selling in ${countryPhrase}`}
      </h2>
      <p className="text-[13px] text-muted">
        {summary.sellingEnabled
          ? `Prices are shown in ${currency}. Everything below comes from this market's own row.`
          : `This market is closed: nothing is sold in ${countryPhrase} yet. Everything below comes from this market's own row.`}
      </p>

      <dl className="grid gap-2 text-[14px] sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="grid gap-1 sm:col-span-2 sm:grid-cols-subgrid">
          <dt className="text-faint">Currency</dt>
          <dd className="text-ink-2">{currency}</dd>
        </div>
        <div className="grid gap-1 sm:col-span-2 sm:grid-cols-subgrid">
          <dt className="text-faint">{tax.name ?? "Tax"}</dt>
          <dd className={`flex flex-wrap items-center gap-2 ${TAX_TONE[tax.state]}`}>
            {tax.line} <WhyLink ruleId={tax.ruleId} context="market tax treatment" />
          </dd>
        </div>
        <div className="grid gap-1 sm:col-span-2 sm:grid-cols-subgrid">
          <dt className="text-faint">Price ladder</dt>
          <dd className="text-ink-2">{summary.priceNote}</dd>
        </div>
        <div className="grid gap-1 sm:col-span-2 sm:grid-cols-subgrid">
          <dt className="text-faint">Delivery</dt>
          <dd className="text-warn">{summary.deliveryNote}</dd>
        </div>
      </dl>

      <h3 className="pt-1 text-[15px] font-medium text-ink">{`Label lines for ${countryName}`}</h3>
      <ul aria-label={`Label lines for ${countryName}`} className="flex flex-col gap-2">
        {labelLines.map((line) => (
          <li key={line.kind} className="flex flex-col gap-0.5 rounded-[1.25rem] border border-white/12 p-3">
            <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink">
              {line.title}
              <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${line.ready ? "text-muted" : "text-warn"}`}>
                {line.ready ? "On the label" : "Not on the label"}
              </span>
            </p>
            <p className={`text-[13px] ${line.ready ? "text-ink-2" : "text-warn"}`}>{line.note}</p>
            <p className="flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
              {line.source ?? "No source on file"} <WhyLink ruleId={line.ruleId} context="market label line" />
            </p>
          </li>
        ))}
      </ul>

      <h3 className="pt-1 text-[15px] font-medium text-ink">{`Still missing for ${market.label}`}</h3>
      {gaps.length === 0 ? (
        <p className="text-[14px] text-ink-2">Nothing is missing for this market.</p>
      ) : (
        <ul aria-label={`Still missing for ${market.label}`} className="flex flex-col gap-1.5 text-[13.5px] text-warn">
          {gaps.map((gap) => (
            <li key={`${gap.ruleId}-${gap.note}`} className="flex flex-wrap items-center gap-2">
              {gap.note} <WhyLink ruleId={gap.ruleId} context="market gap" />
            </li>
          ))}
        </ul>
      )}
      {summary.rowLabel ? <p className="text-[11.5px] text-faint">{summary.rowLabel}</p> : null}
    </section>
  );
}
