import { WhyLink } from "@/components/rulebook/WhyLink";
import { GarmentOutline } from "@/components/home/GarmentOutline";
import { RENDER_NOTICE, type FabricCard, type FitNote, type LeadTime, type SizeChart } from "@/lib/home/article-view";
import type { LadderRow } from "@/lib/home/price";

/**
 * The sections of an article page (spec F-S8): the pictures, the price ladder, the fabrics with
 * their spec cards, the size chart, the fit notes, the care wording and the lead time. Every row
 * carries a "Why?" link to the rule behind it, and every placeholder keeps the label of the row it
 * came from.
 */

const PANEL = "glass flex flex-col gap-3 rounded-[1.75rem] p-5 sm:p-6";
const HEADING = "text-lg font-medium tracking-[-0.01em] text-ink";
const CELL = "px-3 py-2 text-left align-top";

/** The pictures. There are no sample photographs, so each one says it is a render. */
export function ArticlePhotos({ name }: Readonly<{ name: string }>) {
  return (
    <section aria-labelledby="photos" className={PANEL}>
      <h2 id="photos" className={HEADING}>
        Pictures
      </h2>
      <div className="dot-grid grid h-56 place-items-center rounded-[1.25rem] border border-white/8">
        <GarmentOutline />
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">{RENDER_NOTICE.label}</p>
      </div>
      <p className="text-[13px] text-muted">{RENDER_NOTICE.note}</p>
      <p className="sr-only">{`A placeholder outline where a photograph of ${name} will go.`}</p>
    </section>
  );
}

export function PriceLadder({ rows, currency }: Readonly<{ rows: readonly LadderRow[]; currency: string }>) {
  return (
    <section aria-labelledby="prices" className={PANEL}>
      <h2 id="prices" className={HEADING}>
        Price ladder
      </h2>
      {rows.length === 0 ? (
        <p className="text-[15px] text-ink-2">No price ladder is on file for this article yet.</p>
      ) : (
        <table className="w-full text-[14.5px] text-ink-2">
          <caption className="sr-only">{`Price for each quantity, in ${currency}`}</caption>
          <thead>
            <tr className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">
              <th scope="col" className={CELL}>
                Pieces
              </th>
              <th scope="col" className={CELL}>
                Each
              </th>
              <th scope="col" className={CELL}>
                Where it comes from
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.quantity} className="border-t border-white/8">
                <th scope="row" className={`${CELL} font-mono font-normal text-ink`}>
                  {row.quantity}
                </th>
                <td className={`${CELL} ${row.priced ? "text-ink" : "text-muted"}`}>{row.unit}</td>
                <td className={CELL}>
                  <span className="text-[12.5px] text-faint">{row.label}</span>{" "}
                  <WhyLink ruleId={row.ruleId} context="article price ladder" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function FabricCards({ cards }: Readonly<{ cards: readonly FabricCard[] }>) {
  return (
    <section aria-labelledby="fabrics" className={PANEL}>
      <h2 id="fabrics" className={HEADING}>
        Fabrics
      </h2>
      {cards.length === 0 ? (
        <p className="text-[15px] text-ink-2">No fabric is on file for this article yet.</p>
      ) : (
        <ul aria-label="Fabrics" className="grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.code} className="flex flex-col gap-1.5 rounded-[1.25rem] border border-white/12 p-4">
              <h3 className="text-[15px] font-medium text-ink">
                {card.name} <span className="font-mono text-[12px] text-muted">{card.code}</span>
              </h3>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
                {[
                  ["Role", card.role ?? "Not set yet"],
                  ["Blend", card.blend],
                  ["Weight", card.gsm],
                  ["Width", card.width],
                  ["Stretch", card.stretch],
                  ["Finish", card.finish],
                  ["Print", card.sublimation],
                ].map(([label, value]) => (
                  <div key={label} className="col-span-2 grid grid-cols-subgrid">
                    <dt className="text-faint">{label}</dt>
                    <dd className="text-ink-2">{value}</dd>
                  </div>
                ))}
              </dl>
              {card.colours.length > 0 ? (
                <ul aria-label={`Stock colours of ${card.code}`} className="flex flex-wrap gap-1.5 pt-1">
                  {card.colours.map((colour) => (
                    <li key={colour.name} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-2 py-0.5 text-[12px] text-ink-2">
                      <span className="size-3 rounded-full border border-white/20" style={{ backgroundColor: colour.hex }} aria-hidden="true" />
                      {colour.name}
                    </li>
                  ))}
                </ul>
              ) : null}
              {card.description ? <p className="text-[12.5px] text-ink-2">{card.description}</p> : null}
              {card.note ? <p className="text-[12.5px] text-warn">{card.note}</p> : null}
              <p className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-[11.5px] text-faint">
                {card.label} <WhyLink ruleId={card.ruleId} context="article fabric card" />
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SizeChartTable({ chart }: Readonly<{ chart: SizeChart }>) {
  return (
    <section aria-labelledby="sizes" className={PANEL}>
      <h2 id="sizes" className={HEADING}>
        Size chart
      </h2>
      {chart.empty ? (
        <p className="text-[15px] text-ink-2">{chart.empty}</p>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            Finished garment measurements in millimetres.
            {chart.sampleSize ? ` The sample size is ${chart.sampleSize}.` : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-[13.5px] text-ink-2">
              <caption className="sr-only">Finished measurements of each size, in millimetres</caption>
              <thead>
                <tr className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint">
                  <th scope="col" className={CELL}>
                    Point
                  </th>
                  <th scope="col" className={CELL}>
                    Grade
                  </th>
                  <th scope="col" className={CELL}>
                    Tolerance
                  </th>
                  {chart.sizes.map((size) => (
                    <th key={size} scope="col" className={`${CELL} ${size === chart.sampleSize ? "text-warn" : ""}`}>
                      {size}
                      {size === chart.sampleSize ? <span className="sr-only"> (sample size)</span> : null}
                    </th>
                  ))}
                  <th scope="col" className={CELL}>
                    Why
                  </th>
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row) => (
                  <tr key={row.letter} className="border-t border-white/8">
                    <th scope="row" className={`${CELL} font-normal text-ink`}>
                      {row.letter} · {row.description}
                    </th>
                    <td className={CELL}>{row.grade}</td>
                    <td className={CELL}>{row.tolerance}</td>
                    {row.values.map((value, at) => (
                      <td key={chart.sizes[at]} className={CELL}>
                        {value ?? "—"}
                      </td>
                    ))}
                    <td className={CELL}>
                      <WhyLink ruleId={row.ruleId} context="article size chart" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

type NotesProps = Readonly<{ fit: readonly FitNote[]; care: FitNote; lead: LeadTime }>;

export function ArticleNotes({ fit, care, lead }: NotesProps) {
  return (
    <section aria-labelledby="notes" className={PANEL}>
      <h2 id="notes" className={HEADING}>
        Fit, care and lead time
      </h2>
      <dl className="flex flex-col gap-2 text-[14px]">
        {[...fit, care].map((note) => (
          <div key={note.label} className="flex flex-wrap items-baseline gap-2">
            <dt className="min-w-36 text-faint">{note.label}</dt>
            <dd className="flex flex-wrap items-center gap-2 text-ink-2">
              {note.value} <WhyLink ruleId={note.ruleId} context="article fit note" />
            </dd>
          </div>
        ))}
        <div className="flex flex-wrap items-baseline gap-2">
          <dt className="min-w-36 text-faint">Lead time</dt>
          <dd className="flex flex-wrap items-center gap-2 text-ink-2">
            {lead.value} <WhyLink ruleId={lead.ruleId} context="article lead time" />
          </dd>
        </div>
      </dl>
      {lead.label ? <p className="text-[11.5px] text-faint">{lead.label}</p> : null}
    </section>
  );
}
