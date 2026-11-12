import { WhyLink } from "@/components/rulebook/WhyLink";
import { cx } from "@/components/ui/cx";
import type { MarketSummary } from "@/lib/markets/view";

/**
 * What choosing a market means (spec F-S8; plan v5 O3, decision 0104), moved from the old article page: the
 * currency, the tax treatment, the label lines a garment sold there may carry, and what is still missing before a
 * date can be promised. Every line is read from `lib/markets`, and every gap carries the rule that explains it.
 */

const TAX_TONE = { charged: "text-text-2", "not-registered": "text-warn", "not-recorded": "text-warn" } as const;

export function MarketDetails({ summary }: Readonly<{ summary: MarketSummary }>) {
  const { market, countryName, countryPhrase, currency, tax, labelLines, gaps } = summary;
  return (
    <section aria-labelledby="market" className="flex flex-col gap-3 rounded-xl border border-border p-5">
      <h2 id="market" className="text-title text-text">{`Selling in ${countryPhrase}`}</h2>
      <p className="text-small text-muted">
        {summary.sellingEnabled
          ? `Prices are shown in ${currency}. Everything below comes from this market's own row.`
          : `This market is closed: nothing is sold in ${countryPhrase} yet. Everything below comes from this market's own row.`}
      </p>
      <dl className="grid gap-x-6 gap-y-2 text-body sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-muted">Currency</dt>
        <dd className="text-text-2">{currency}</dd>
        <dt className="text-muted">{tax.name ?? "Tax"}</dt>
        <dd className={cx("flex flex-wrap items-center gap-2", TAX_TONE[tax.state])}>
          {tax.line} <WhyLink ruleId={tax.ruleId} context="market tax treatment" />
        </dd>
        <dt className="text-muted">Price ladder</dt>
        <dd className="text-text-2">{summary.priceNote}</dd>
        <dt className="text-muted">Delivery</dt>
        <dd className="text-warn">{summary.deliveryNote}</dd>
      </dl>
      <h3 className="pt-1 text-body-lg font-semibold text-text">{`Label lines for ${countryName}`}</h3>
      <ul aria-label={`Label lines for ${countryName}`} className="grid gap-2 md:grid-cols-2">
        {labelLines.map((line) => (
          <li key={line.kind} className="flex flex-col gap-0.5 rounded-lg bg-soft p-3">
            <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-text">
              {line.title}
              <span className={cx("text-micro uppercase", line.ready ? "text-muted" : "text-warn")}>{line.ready ? "On the label" : "Not on the label"}</span>
            </p>
            <p className={cx("text-small", line.ready ? "text-text-2" : "text-warn")}>{line.note}</p>
            <p className="flex flex-wrap items-center gap-2 text-caption text-muted">
              {line.source ?? "No source on file"} <WhyLink ruleId={line.ruleId} context="market label line" />
            </p>
          </li>
        ))}
      </ul>
      <h3 className="pt-1 text-body-lg font-semibold text-text">{`Still missing for ${market.label}`}</h3>
      {gaps.length === 0 ? (
        <p className="text-body text-text-2">Nothing is missing for this market.</p>
      ) : (
        <ul aria-label={`Still missing for ${market.label}`} className="flex flex-col gap-1.5 text-small text-warn">
          {gaps.map((gap) => (
            <li key={`${gap.ruleId}-${gap.note}`} className="flex flex-wrap items-center gap-2">
              {gap.note} <WhyLink ruleId={gap.ruleId} context="market gap" />
            </li>
          ))}
        </ul>
      )}
      {summary.rowLabel ? <p className="text-caption text-muted">{summary.rowLabel}</p> : null}
    </section>
  );
}
