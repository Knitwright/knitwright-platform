"use client";

import type { ClubColours } from "@/lib/kit-styles/presets";
import { BUNDLES, type KitBundleId, type KitPartId, type PanelRow } from "@/lib/teamwear";
import { RowControl, type RowHandlers } from "./PanelRows";

/**
 * The right panel of spec F-T1: the product name, the pill row for the parts of the kit with a tick
 * on each part that is done, and the accordion of decision rows.
 *
 * On a phone it is a bottom sheet over the stage: from `lg` up it is a column of the page, and
 * below that it is fixed to the bottom of the window, which the browser test on a phone viewport
 * checks by reading the panel's own position.
 */

export type PartPill = Readonly<{ id: KitPartId; label: string; done: boolean }>;

export type RightPanelProps = Readonly<{
  title: string;
  parts: readonly PartPill[];
  part: KitPartId;
  onPart: (part: KitPartId) => void;
  rows: readonly PanelRow[];
  openRow: string | null;
  onOpenRow: (row: string | null) => void;
  colours: ClubColours;
  socksColour: string;
  bundleId: string | null;
  onBundle: (bundle: KitBundleId) => void;
  /** Why a bundle could not be applied, in the words the club reads. */
  bundleProblem: string | null;
  handlers: RowHandlers;
}>;

const SHEET =
  "fixed inset-x-0 bottom-0 z-30 max-h-[72dvh] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#10131a] p-4 pb-28 shadow-2xl lg:static lg:z-auto lg:max-h-none lg:rounded-2xl lg:border lg:pb-4 lg:shadow-none";

export function RightPanel(props: RightPanelProps) {
  const { parts, part, rows, openRow } = props;
  return (
    <section className={SHEET} aria-label="Your kit" data-testid="teamwear-panel">
      <h2 className="text-[17px] font-medium text-ink">{props.title}</h2>

      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Parts of the kit" data-testid="teamwear-pills">
        {parts.map((pill) => (
          <button
            key={pill.id}
            type="button"
            role="tab"
            aria-selected={pill.id === part}
            onClick={() => props.onPart(pill.id)}
            className={`flex h-11 items-center gap-2 rounded-full border px-4 text-[15px] ${pill.id === part ? "border-white/40 bg-white/15 text-ink" : "border-white/15 text-muted"}`}
            data-testid={`teamwear-pill-${pill.id}`}
            data-done={pill.done}
          >
            {pill.done ? <span aria-hidden="true">✓</span> : null}
            <span>{pill.label}</span>
            <span className="sr-only">{pill.done ? ", done" : ", not done yet"}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" data-testid="teamwear-bundles">
        <span className="w-full text-xs uppercase tracking-wide text-muted">Kit bundles</span>
        {BUNDLES.map((bundle) => (
          <button
            key={bundle.id}
            type="button"
            onClick={() => props.onBundle(bundle.id)}
            aria-pressed={props.bundleId === bundle.id}
            title={bundle.hint}
            className={`flex h-11 items-center rounded-full border px-4 text-[15px] ${props.bundleId === bundle.id ? "border-white/40 bg-white/15 text-ink" : "border-white/15 text-muted"}`}
            data-testid={`teamwear-bundle-${bundle.id}`}
          >
            {bundle.label}
          </button>
        ))}
        {props.bundleProblem === null ? null : (
          <p className="w-full text-sm text-muted" data-testid="teamwear-bundle-problem">
            {props.bundleProblem}
          </p>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-1" data-testid="teamwear-rows">
        {rows.map((row) => {
          const open = openRow === row.id;
          return (
            <li key={row.id} className="rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => props.onOpenRow(open ? null : row.id)}
                aria-expanded={open}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left"
                data-testid={`teamwear-row-${row.id}`}
                data-value={row.value}
                data-rule-id={row.ruleId}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] text-ink">{row.label}</span>
                  <span className="truncate text-xs text-muted">{row.value}</span>
                </span>
                <span aria-hidden="true" className="text-muted">
                  {open ? "⌃" : "›"}
                </span>
              </button>
              {open ? (
                <div className="border-t border-white/10 px-3 py-3" data-testid={`teamwear-row-open-${row.id}`}>
                  <RowControl row={row} colours={props.colours} socksColour={props.socksColour} isSocks={part === "socks"} handlers={props.handlers} />
                  <p className="mt-2 text-[11px] text-muted">Rule {row.ruleId}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
