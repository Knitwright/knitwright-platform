"use client";

import { PROVENANCE_CHIPS, PROVENANCE_ORDER, PROVENANCE_TONE, type FieldProvenance, type ViewCell } from "@/lib/techpack/view";
import { WhyButton } from "../WhyButton";

/**
 * The provenance chip spec F-S6 puts on every field, the lock on a value the base article fixes,
 * and the "Why?" beside it. One component, so a chip cannot be drawn one way on one tab and another
 * way on another.
 */

const TONE_CLASS: Readonly<Record<"green" | "blue" | "amber" | "neutral", string>> = {
  green: "border-ok/40 text-ok",
  blue: "border-cobalt/50 text-cobalt",
  amber: "border-warn/50 text-warn",
  neutral: "border-white/20 text-chalk-muted",
};

export function ProvenanceChip({ provenance }: Readonly<{ provenance: FieldProvenance }>) {
  return (
    <span
      data-testid={`chip-${provenance}`}
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.06em] uppercase ${TONE_CLASS[PROVENANCE_TONE[provenance]]}`}
    >
      {PROVENANCE_CHIPS[provenance]}
    </span>
  );
}

/** The legend above the tabs: what each chip means, and how many fields wear it. */
export function ChipLegend({ counts }: Readonly<{ counts: Readonly<Record<FieldProvenance, number>> }>) {
  return (
    <ul aria-label="What the chips mean" className="flex flex-wrap items-center gap-2" data-testid="techpack-legend">
      {PROVENANCE_ORDER.map((id) => (
        <li key={id} className="flex items-center gap-1 text-[11px] text-chalk-muted">
          <ProvenanceChip provenance={id} />
          <span>{counts[id]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Nothing at all for a value a person has, and the words a factory reads for one nobody has. */
export const NOTHING_YET = "Nobody has given this yet.";

/**
 * One cell: its value, or the words that say nobody has given it, then its chip, then the lock and
 * the "Why?" when the base article fixes it.
 */
export function CellValue({ cell, context }: Readonly<{ cell: ViewCell; context: string }>) {
  return (
    <span className="flex flex-wrap items-center gap-1" data-testid={`cell-${cell.id}`}>
      <span className={cell.text === null ? "text-[13px] text-warn" : "text-[13px] text-ink"}>{cell.text ?? NOTHING_YET}</span>
      <ProvenanceChip provenance={cell.provenance} />
      {cell.locked ? (
        <span className="text-[11px] text-chalk-muted" title="The base article fixes this">
          <span aria-hidden="true">&#128274;</span>
          <span className="sr-only">Fixed by the base article.</span>
        </span>
      ) : null}
      <WhyButton ruleId={cell.ruleId} context={`${context} ${cell.id}`} />
    </span>
  );
}
