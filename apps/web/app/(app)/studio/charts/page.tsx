import type { Metadata } from "next";
import { ChartImport } from "@/components/charts/ChartImport";
import { listBrandCharts } from "@/lib/charts/service";
import { chartSummary } from "@/lib/charts/stored";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Size charts" };

const HEADINGS = ["Garment", "Wearer", "Fit", "Sizes", "Base size", "Points", "Source"] as const;

export default async function ChartsPage() {
  const { brand } = await requireMember();
  const charts = (await listBrandCharts(await sessionClient(), brand.id)).map(chartSummary);

  return (
    <>
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">{brand.name}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Size charts</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Your own charts. A design for the same garment and wearer takes its sizes and measurements from here, marked as
          supplied by your brand. Importing a file for a garment, wearer and fit replaces the chart you had for it.
        </p>
      </header>
      {charts.length === 0 ? (
        <p className="mt-8 text-[15px] text-muted">{brand.name} has no charts of its own yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-hairline bg-surface">
          <table className="w-full min-w-[40rem] text-left text-[15px]">
            <caption className="sr-only">Size charts of {brand.name}</caption>
            <thead>
              <tr className="border-b border-hairline text-sm text-muted">
                {HEADINGS.map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {charts.map((chart) => (
                <tr key={chart.key}>
                  <td className="px-4 py-3">{chart.garment}</td>
                  <td className="px-4 py-3">{chart.wearer}</td>
                  <td className="px-4 py-3">{chart.fit}</td>
                  <td className="px-4 py-3">{chart.sizes}</td>
                  <td className="px-4 py-3">{chart.baseSize}</td>
                  <td className="px-4 py-3">{chart.points}</td>
                  <td className="px-4 py-3">{chart.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ChartImport />
    </>
  );
}
