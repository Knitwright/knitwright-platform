"use client";

import { useState } from "react";
import { CARD_KINDS, cardNote, EMPTY_FACTS, infoCard, type CardKind, type InfoCardFacts } from "@/lib/flows";
import { lengthUnitFrom, type LengthUnit } from "@/lib/units/length";
import type { LaunchPanelProps } from "@/lib/launch";

/**
 * THE INFO CARD BOARD (spec F-L4's board table), which is the `board-info-card` panel of L1's
 * contract.
 *
 * It is the one board in a flow that holds no picture of anything: it holds the garment's own facts.
 * So the rules it keeps are about honesty rather than pixels. **Nothing is invented**: a measurement,
 * a weight or a care symbol the platform has not been given is shown as missing, and the heading
 * says how many are. And a size chart is garment measurements, which the card says out loud, because
 * the spec's own returns rule depends on it.
 *
 * The facts come in through `InfoCardSource`, whose real implementation reads the factory file and
 * the catalogue. Until that is wired the panel shows the empty state with the one action that fills
 * it, which is what an empty card should look like anyway.
 */

export type InfoCardPanelProps = LaunchPanelProps &
  Readonly<{
    /** The garment's own facts, or nothing while they have not been read. */
    facts?: InfoCardFacts;
  }>;

const TAB = "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3 text-[12px] text-ink";

const cardOf = (value: unknown): CardKind => {
  const written = typeof value === "string" ? value : "";
  return (CARD_KINDS as readonly string[]).includes(written) ? (written as CardKind) : "size_chart";
};

export default function InfoCardPanel({ context, commands, facts = EMPTY_FACTS }: InfoCardPanelProps) {
  const board = context.selection?.board ?? null;
  const [chosen, setChosen] = useState<CardKind | null>(null);
  const kind = chosen ?? cardOf(board?.settings["card"]);
  const unit: LengthUnit = lengthUnitFrom(context.unit === "in" ? "in" : "cm");
  const view = infoCard(kind, facts, unit);

  const choose = (next: CardKind): void => {
    setChosen(next);
    // The board keeps which card it is, so a rerun draws the same one (spec F-L4).
    if (board) commands.setBoardSettings(board.id, { ...board.settings, card: next });
  };

  return (
    <section aria-label="Info card" data-testid="launch-panel-board-info-card" className="flex min-h-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{view.title}</h2>
        <p className="text-[13px] leading-relaxed text-ink-2">{view.lead}</p>
      </header>

      <ul className="flex flex-wrap gap-1.5" aria-label="Which card">
        {CARD_KINDS.map((one) => (
          <li key={one}>
            <button
              type="button"
              aria-pressed={one === kind}
              disabled={context.busy}
              onClick={() => choose(one)}
              className={`${TAB} ${one === kind ? "border-cobalt text-ink" : "text-ink-2"}`}
              data-testid={`info-card-${one}`}
            >
              {infoCard(one, EMPTY_FACTS).title}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-[12px] leading-relaxed text-ink-2" data-testid="info-card-note">
        {cardNote(view)}
      </p>

      {view.empty === null ? null : (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-white/20 p-4" data-testid="info-card-empty">
          <h3 className="text-[15px] font-medium text-ink">{view.empty.title}</h3>
          <p className="text-[13px] leading-relaxed text-ink-2">{view.empty.body}</p>
          <button type="button" disabled={context.busy} onClick={() => commands.addBoard("design", { x: 0, y: 0 })} className={TAB} data-testid="info-card-action">
            {view.empty.action}
          </button>
        </div>
      )}

      {view.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h3 className="text-[13px] font-medium text-ink">{section.heading}</h3>
          {section.rows.length === 0 ? null : section.columns.length === 0 ? (
            <dl className="flex flex-col gap-1">
              {section.rows.map((row) => (
                <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-1">
                  <dt className="text-[12px] text-ink-2">{row.label}</dt>
                  <dd className={`text-[12px] ${row.cells[0]?.missing ? "text-warn" : "text-ink"}`}>{row.cells[0]?.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            // A real table, because this is tabular data and a screen reader reads it as one.
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-left">
                <caption className="sr-only">{section.heading}</caption>
                <thead>
                  <tr>
                    {section.columns.map((column) => (
                      <th key={column} scope="col" className="border-b border-white/15 px-2 py-1 font-mono text-[10px] tracking-[0.08em] text-ink-2 uppercase">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="border-b border-white/10 px-2 py-1 text-[12px] font-normal text-ink-2">
                        {row.label}
                      </th>
                      {row.cells.map((cell, at) => (
                        <td
                          key={`${row.label}-${at}`}
                          className={`border-b border-white/10 px-2 py-1 text-[12px] ${cell.missing ? "text-warn" : "text-ink"}`}
                        >
                          {cell.value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <p className="font-mono text-[10px] tracking-[0.08em] text-ink-2 uppercase">Rule {view.ruleId}</p>
    </section>
  );
}
