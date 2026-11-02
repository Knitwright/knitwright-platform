"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/Notice";
import {
  estimateFlow,
  estimateSummary,
  flowRunLabel,
  listingPayload,
  listingVerdict,
  runSummary,
  summaryLine,
  type FlowCostSource,
  type FlowRunReport,
  type FlowSummary,
  type SummaryRow,
} from "@/lib/flows";
import { affordable, type LaunchPanelProps } from "@/lib/launch";

/**
 * THE RUN SUMMARY (spec F-L4: "a side panel lists every output, its status and cost"), which is the
 * `flow-run` panel of L1's contract.
 *
 * The one thing this panel must never do is let a person spend credits without having seen the
 * figure first. So the cost is the first thing on it, the Run all button carries the figure in its
 * own words, a paid run asks again before it starts, and a run the balance will not cover is
 * refused here with what it costs and what the balance is -- rather than failing half way through.
 *
 * **It never makes a price up.** The figure comes from the platform's own credit prices, through
 * `costs`. Without one there is no estimate: the panel says the price could not be read and Run all
 * is off, exactly as the shell refuses a run against a balance nobody could read. A zero would be a
 * lie, and this is the screen that promises not to tell one.
 *
 * Three real states, each saying what to do next: nothing run yet (the estimate and one named
 * action), running (a line per board, so the canvas is never a frozen picture), and finished (every
 * output, what it cost after refunds, what failed and what that cost, then Export all).
 */

export type FlowRunPanelProps = LaunchPanelProps &
  Readonly<{
    /** The platform's credit prices. Null when they could not be read: no figure is then shown. */
    costs?: FlowCostSource | null;
    /** The run this canvas last did, read back from the flow tables, or null. */
    report?: FlowRunReport | null;
    /** What is happening now, while a run is in flight. */
    busyNote?: string | null;
    /**
     * Runs the whole canvas through this workstream's own action (`runFlowAction`, scope "all").
     * Without it the panel asks the shell instead, through `requestRunDownstream` on the Design
     * board, which the shell answers by checking the lock and the cost and stopping -- the shell
     * makes no paid call of its own (decision 0091, item 6).
     */
    onRunAll?: (shownCredits: number) => void;
    onExportAll?: () => void;
    onPublishListing?: () => void;
  }>;

const STATE_WORDS: Readonly<Record<SummaryRow["state"], string>> = {
  queued: "Waiting",
  running: "Running",
  ready: "Ready",
  failed: "Did not finish",
  skipped: "Not run",
};

const NO_PRICE = "The credit price could not be read just now, so this run has no figure yet. Open the credits page and come back.";

const CHIP = "chip-btn inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-[13px] text-ink";

export default function FlowRunPanel({ context, commands, costs = null, report = null, busyNote = null, onRunAll, onExportAll, onPublishListing }: FlowRunPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const graph = { boards: context.project.boards, edges: context.project.edges };
  const estimate = costs === null ? null : estimateFlow(graph, { from: null, scope: "all" }, costs);
  const summary: FlowSummary | null = report !== null ? runSummary(graph, report) : estimate === null ? null : estimateSummary(estimate);
  const money = estimate === null ? null : affordable({ ...estimate, lines: [] }, context.credits);
  const design = context.project.boards.find((one) => one.kind === "design") ?? null;
  const listing = listingVerdict(
    listingPayload(graph, {
      launchProjectId: context.project.id,
      title: context.project.name,
      designProjectId: context.project.designProjectId,
      designVersion: design?.inputVersion ?? null,
    }),
  );
  /**
   * Run all is `requestRunDownstream` on the Design board, not on the first board of the estimate.
   * Every board of a flow descends from the Design board, so "everything this one feeds" is the
   * whole canvas; starting from the first runnable board would quietly run one branch of it and
   * leave the other renders alone. The contract has no "run everything" of its own, and this is
   * what it means here.
   */
  const canRun = estimate !== null && estimate.lines.length > 0 && design !== null && money?.affordable === true && !context.busy;

  /** Why Run all is off, or null. A disabled button with no sentence beside it explains nothing. */
  const whyNot = ((): string | null => {
    if (canRun) return null;
    if (estimate === null) return NO_PRICE;
    if (design === null) return "Add a Design board first: every board of a flow starts from the design the platform drew.";
    if (estimate.lines.length === 0) return "There is nothing on this canvas to run yet.";
    if (money !== null && !money.affordable) return money.reason;
    return "Something else is saving just now. This will come back when it finishes.";
  })();

  return (
    <section aria-label="Run summary" data-testid="launch-panel-flow-run" className="flex min-h-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">Run summary</h2>
        <p className="text-[13px] leading-relaxed text-ink-2">
          {summary === null ? "Every output of this flow, its status and what it cost." : summaryLine(summary)}
        </p>
      </header>

      {/* The cost, before anything is spent. Unmissable on purpose. */}
      {estimate === null ? (
        <Notice tone="warn" role="alert">
          {NO_PRICE}
        </Notice>
      ) : (
        <div className="rounded-2xl border border-cobalt-soft/30 bg-cobalt-wash p-3" data-testid="flow-estimate">
          <p className="text-[13px] font-medium text-ink">{estimate.credits === 0 ? "This run is free." : `This run costs ${estimate.credits} credits.`}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">
            {estimate.assets} {estimate.assets === 1 ? "asset" : "assets"} from {estimate.lines.length}{" "}
            {estimate.lines.length === 1 ? "board" : "boards"}
            {context.credits === null ? "" : `, against a balance of ${context.credits}`}. Nothing is spent until you press Run all.
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{estimate.note}</p>
        </div>
      )}

      {busyNote === null ? null : (
        <Notice tone="info" role="status">
          {busyNote}
        </Notice>
      )}

      {money === null || money.affordable ? null : (
        <Notice tone="warn" role="alert">
          {money.reason}
        </Notice>
      )}

      {summary?.empty == null ? null : (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-white/20 p-4" data-testid="flow-run-empty">
          <h3 className="text-[15px] font-medium text-ink">{summary.empty.title}</h3>
          <p className="text-[13px] leading-relaxed text-ink-2">{summary.empty.body}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canRun}
          aria-describedby={whyNot === null ? undefined : "flow-run-why"}
          onClick={() => {
            if (estimate === null || design === null) return;
            if (estimate.credits > 0 && !confirming) {
              setConfirming(true);
              return;
            }
            setConfirming(false);
            // The figure the person just agreed to goes with the request, so the action can refuse
            // a run that has since become dearer (decision 0096, item 4).
            if (onRunAll) onRunAll(estimate.credits);
            else commands.requestRunDownstream(design.id);
          }}
          className={CHIP}
          data-testid="flow-run-all"
        >
          {estimate === null ? "Run all" : confirming ? `Yes, spend ${estimate.credits} credits` : flowRunLabel(estimate)}
        </button>
        {confirming ? (
          <button type="button" onClick={() => setConfirming(false)} className={CHIP} data-testid="flow-run-cancel">
            Not now
          </button>
        ) : null}
      </div>
      {whyNot === null ? null : (
        <p className="text-[12px] leading-relaxed text-ink-2" id="flow-run-why" data-testid="flow-run-why">
          {whyNot}
        </p>
      )}

      {summary === null || summary.rows.length === 0 ? null : (
        <ol className="flex flex-col gap-1.5" data-testid="flow-run-rows">
          {summary.rows.map((row) => (
            <li key={row.boardId} className="rounded-2xl border border-white/10 bg-tile-2/80 p-3" data-testid={`flow-row-${row.boardId}`}>
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-ink">{row.name}</span>
                <span className="font-mono text-[11px] text-ink-2">
                  {STATE_WORDS[row.state]} · {row.format}
                  {row.credits === 0 && row.refunded === 0 ? " · free" : ""}
                  {row.credits > 0 ? ` · ${row.credits} credits` : ""}
                  {row.refunded > 0 ? ` · ${row.refunded} given back` : ""}
                </span>
              </p>
              {row.label === null ? null : <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-ink-2 uppercase">{row.label}</p>}
              {row.reason === null ? null : (
                <p className="mt-1 text-[12px] leading-relaxed text-ink-2" data-testid={`flow-reason-${row.boardId}`}>
                  {row.reason}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {summary === null || summary.byFormat.length === 0 ? null : (
        <p className="text-[12px] text-ink-2" data-testid="flow-folders">
          The zip holds {summary.byFormat.map((one) => `${one.count} in ${one.format}/`).join(", ")}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={context.busy || summary?.canExport !== true}
          onClick={onExportAll}
          className={CHIP}
          data-testid="flow-export-all"
        >
          Export all (zip)
        </button>
        <button
          type="button"
          disabled={context.busy || !listing.ready}
          aria-describedby="flow-listing-why"
          onClick={onPublishListing}
          className={CHIP}
          data-testid="flow-publish"
        >
          Publish to store
        </button>
      </div>
      <p className="text-[12px] leading-relaxed text-ink-2" id="flow-listing-why">
        {listing.ready
          ? "Publish to store hands the pictures to the store as a listing. Nothing is published, priced or put on sale here."
          : listing.reason}
      </p>
    </section>
  );
}
