import type { SizeGuide } from "@/lib/clubs/signup/size-guide";

/**
 * The size guide on the sign-up page (spec F-T4 step 2). It scrolls sideways on a phone rather than
 * squeezing, and the region is reachable with a keyboard and has a name, as the factory file's wide
 * tables do (decision 0064).
 */
export function SizeGuideTable({ guide, label }: Readonly<{ guide: SizeGuide; label: string }>) {
  if (guide.notice !== null) return <p className="text-sm text-muted">{guide.notice}</p>;
  return (
    <div className="flex flex-col gap-2">
      <div
        role="region"
        aria-label={`Size guide, ${label}`}
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-hairline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft"
      >
        <table className="w-full min-w-[22rem] border-collapse text-sm">
          <caption className="px-3 py-2 text-left text-sm text-muted">{guide.source}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium text-ink">
                Size
              </th>
              {guide.points.map((point) => (
                <th key={point.pointId} scope="col" className="px-3 py-2 text-left font-medium text-ink">
                  {point.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.rows.map((row) => (
              <tr key={row.sizeLabel} className="border-t border-hairline">
                <th scope="row" className="px-3 py-2 text-left font-medium text-ink">
                  {row.sizeLabel}
                </th>
                {guide.points.map((point) => (
                  <td key={point.pointId} className="px-3 py-2 text-ink-2">
                    {row.cells.find((cell) => cell.pointId === point.pointId)?.value ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-1 text-sm text-muted">
        {guide.points.map((point) => (
          <li key={point.pointId}>
            <strong className="font-medium text-ink-2">{point.label}:</strong> {point.howToMeasure}
          </li>
        ))}
      </ul>
    </div>
  );
}
