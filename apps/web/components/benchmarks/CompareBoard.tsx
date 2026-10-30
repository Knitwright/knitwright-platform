import { GRAPHICS_NOTE, THEMES_NOTE, type CompareView } from "@/lib/benchmarks";

/**
 * The compare view (spec F-S2 step 5): the cards side by side, the feature matrix, and the complaint themes ranked by
 * how often they came up. Every value carries how it is known, and the legend says what the marks mean, as the spec
 * draws it. Nothing of a competitor's logo, name or print is compared.
 */

const CELL = "px-3 py-2 text-left align-top";

const Bar = ({ count, most }: Readonly<{ count: number; most: number }>) => (
  <span className="flex items-center gap-2">
    <span aria-hidden="true" className="h-2 rounded-full bg-cobalt-soft/60" style={{ width: `${Math.max(6, Math.round((count / most) * 100))}%` }} />
    <span className="font-mono text-xs text-muted">{count}</span>
  </span>
);

export function CompareBoard({ view }: Readonly<{ view: CompareView }>) {
  const most = view.themes[0]?.count ?? 1;

  if (view.refused !== null && view.columns.length < 2) {
    return (
      <p className="mt-8 rounded-2xl border border-hairline bg-surface p-5 text-[15px] text-muted" data-testid="compare-refused">
        {view.refused}
      </p>
    );
  }

  return (
    <section className="mt-8 flex flex-col gap-8" aria-labelledby="compare-heading">
      <h2 id="compare-heading" className="text-lg font-medium text-ink">
        Side by side
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full min-w-[40rem] text-left text-[15px]">
          <caption className="sr-only">The products, with how each value is known</caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className={`${CELL} text-sm font-medium text-muted`}>
                Field
              </th>
              {view.columns.map((column) => (
                <th key={column.id} scope="col" className={`${CELL} font-medium text-ink`} data-testid={`card-heading-${column.id}`}>
                  {column.heading}
                  <span className="mt-1 block text-xs font-normal text-muted">{column.source}</span>
                  <span className="mt-1 block text-xs font-normal text-muted">
                    {column.confirmed ? "Confirmed by your team" : "Not confirmed yet"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {(view.columns[0]?.fields ?? []).map((field, row) => (
              <tr key={field.name}>
                <th scope="row" className={`${CELL} text-sm font-medium text-muted`}>
                  {field.label}
                </th>
                {view.columns.map((column) => {
                  const cell = column.fields[row];
                  return (
                    <td key={column.id} className={CELL} data-testid={`field-${field.name}-${column.id}`}>
                      <span className="text-ink">{cell?.value}</span>
                      <span className="mt-0.5 block text-xs text-muted">{cell?.how}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full min-w-[40rem] text-left text-[15px]">
          <caption className="px-3 py-2 text-left text-sm text-muted">
            What each one has. obs = stated on the page · inf = read off a picture · – = not found. {GRAPHICS_NOTE}
          </caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className={`${CELL} text-sm font-medium text-muted`}>
                Feature
              </th>
              {view.columns.map((column) => (
                <th key={column.id} scope="col" className={`${CELL} text-sm font-medium text-muted`}>
                  {column.heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {view.rows.length === 0 ? (
              <tr>
                <td className={CELL} colSpan={view.columns.length + 1}>
                  No features were found on these products yet.
                </td>
              </tr>
            ) : (
              view.rows.map((row) => (
                <tr key={row.key} data-testid={`matrix-${row.key}`}>
                  <th scope="row" className={`${CELL} font-normal text-ink`}>
                    {row.label}
                    <span className="mt-0.5 block text-xs text-muted">{row.purpose}</span>
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={view.columns[index]?.id ?? index} className={`${CELL} font-mono text-xs`}>
                      {cell.mark}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <h3 className="text-base font-medium text-ink">What customers complain about</h3>
        <p className="mt-1 text-sm text-muted">{THEMES_NOTE}</p>
        {view.themes.length === 0 ? (
          <p className="mt-4 text-[15px] text-muted">No review themes yet. Paste review text to find them.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {view.themes.map((theme, place) => (
              <li key={theme.theme} className="flex flex-col gap-1" data-testid={`theme-${place + 1}`}>
                <span className="text-[15px] text-ink">
                  {place + 1}. {theme.theme}
                </span>
                <Bar count={theme.count} most={most} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
