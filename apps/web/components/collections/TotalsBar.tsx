import type { PlanTotals } from "@/lib/collections/line-plan";
import { percent, pieces, UNIT_COST_IS } from "@/lib/collections/vocabulary";
import { formatMoney } from "@/lib/factory/pricing";

const moneyOr = (minor: number | null, currency: string): string => (minor === null ? "not set" : formatMoney(minor, currency));

/**
 * The navy totals bar under the range plan board (p13): units, production cost, revenue and the
 * blended margin of the whole plan, from the line plan's own totals. A figure any line cannot give
 * reads "not set" rather than a sum that leaves that line out.
 */
export function TotalsBar({ totals, currency }: Readonly<{ totals: PlanTotals; currency: string }>) {
  const figures = [
    ["Total units", pieces(totals.units)],
    ["Production cost", moneyOr(totals.landedCostMinor, currency)],
    ["Wholesale revenue", moneyOr(totals.wholesaleRevenueMinor, currency)],
    ["D2C revenue", moneyOr(totals.d2cRevenueMinor, currency)],
    ["Blended margin", totals.marginBp === null ? "not set" : `${percent(totals.marginBp)}%`],
  ] as const;
  return (
    <section aria-label="Plan totals" className="flex flex-col gap-3 rounded-xl bg-navy px-5 py-4 text-on-dark">
      <dl className="flex flex-wrap gap-x-7 gap-y-2 text-body-lg">
        {figures.map(([label, value]) => (
          <div key={label} className="flex gap-1.5">
            <dt>{label}</dt>
            <dd className="font-semibold text-gold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-small">{UNIT_COST_IS}</p>
    </section>
  );
}
