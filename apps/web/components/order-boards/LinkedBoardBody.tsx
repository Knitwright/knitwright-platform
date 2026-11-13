"use client";

import type { Route } from "next";
import Link from "next/link";
import { cx } from "@/components/ui/cx";
import type { BoardView, Graph } from "@/lib/launch";
import { linkedDesignOf } from "@/lib/order-boards/canvas";
import { techPackLine } from "@/lib/order-boards/summary";
import type { OrderStateSummary, TechPackSummary } from "@/lib/order-boards/types";
import { PANEL_TRIGGER, useOrderBoards, useProjectPanels } from "./OrderBoardsContext";

/**
 * What a Tech pack or an Order board shows on the canvas (plan v6 E4, decision 0148; `08` §5.2,
 * e20, e21), above the board's own card.
 *
 *   * **Tech pack:** the sixteen pages as a stack of thumbnails, live-linked to the garment, with how
 *     many fields still wait for input, the door into the tech pack page (which keeps its address)
 *     and the PDF.
 *   * **Order:** the design's newest order -- what, how many, what it costs, when it is ready, and
 *     where it is on F-T7's timeline -- with its tracking page; or, before there is one, the button
 *     that opens the Order drawer.
 *
 * A board with no garment connected says so instead of linking nowhere.
 */

const DOOR = "chip-btn inline-flex min-h-8 items-center rounded-full border border-border bg-bg px-3 text-caption text-text";
const BODY = "flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-bg p-2.5";

export function LinkedBoardBody({ board, graph }: Readonly<{ board: BoardView; graph: Graph }>) {
  const design = linkedDesignOf(graph, board);
  if (design === null) {
    return (
      <div className={BODY}>
        <p className="text-small text-muted" data-testid={`canvas-linked-none-${board.id}`}>
          Connect a garment board into this one.
        </p>
      </div>
    );
  }
  return board.kind === "tech_pack" ? <TechPackBody board={board} design={design} /> : <OrderBody board={board} design={design} />;
}

function TechPackBody({ board, design }: Readonly<{ board: BoardView; design: string }>) {
  const summary: TechPackSummary | null = useOrderBoards().techPacks[design] ?? null;
  const name = board.name || "Tech pack";
  return (
    <div className={BODY} data-testid={`techpack-board-${board.id}`}>
      {summary === null ? (
        <p className="text-small text-muted">The tech pack could not be read just now. It opens on its own page.</p>
      ) : (
        <>
          <ol className="grid grid-cols-4 gap-1" aria-label={`${summary.pages} pages, live-linked to ${summary.designName} version ${summary.version}`}>
            {summary.thumbnails.map((page) => (
              <li key={page.number} className="flex h-9 flex-col rounded-xs border border-border bg-soft px-1 py-0.5">
                <span className="truncate text-micro text-text-2">
                  {page.number} {page.title}
                </span>
              </li>
            ))}
          </ol>
          <p className={cx("text-caption", summary.needsInput > 0 ? "text-warn" : "text-muted")} data-testid={`techpack-board-line-${board.id}`}>
            {techPackLine(summary)} · live-linked
          </p>
        </>
      )}
      <div className="mt-auto flex flex-wrap gap-1.5">
        <Link
          href={`/studio/${design}/tech-pack` as Route}
          className={DOOR}
          aria-label={`Open tech pack, ${name}`}
          data-testid={`canvas-open-tech_pack-${board.id}`}
        >
          Open tech pack
        </Link>
        {summary === null ? null : (
          <a href={`/api/projects/${design}/exports/pdf?version=${summary.version}`} download className={DOOR} aria-label={`Export PDF, ${name}`}>
            Export PDF
          </a>
        )}
      </div>
    </div>
  );
}

const TONE: Readonly<Record<OrderStateSummary["tone"], string>> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  neutral: "bg-soft text-text-2",
};

const DOT: Readonly<Record<OrderStateSummary["steps"][number]["state"], string>> = {
  done: "bg-ok",
  current: "bg-electric",
  todo: "bg-border-strong",
};

function OrderBody({ board, design }: Readonly<{ board: BoardView; design: string }>) {
  const summary: OrderStateSummary | null = useOrderBoards().orders[design] ?? null;
  const panels = useProjectPanels();
  const name = board.name || "Order";
  const order = (
    <button
      type="button"
      {...{ [PANEL_TRIGGER]: "" }}
      onClick={() => panels.toggle("order")}
      aria-expanded={panels.panel === "order"}
      className={DOOR}
      aria-label={`${summary === null ? "Order" : "Order again"}, ${name}`}
      data-testid={`canvas-open-order-${board.id}`}
    >
      {summary === null ? "Order" : "Order again"}
    </button>
  );

  if (summary === null) {
    return (
      <div className={BODY} data-testid={`order-board-${board.id}`}>
        <p className="text-small text-text">No order yet.</p>
        <p className="text-caption text-muted">Order a sample of up to three sizes, then a run once its golden sample is signed off.</p>
        <div className="mt-auto flex flex-wrap gap-1.5">{order}</div>
      </div>
    );
  }

  return (
    <div className={BODY} data-testid={`order-board-${board.id}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-small font-semibold text-text">
          {summary.title} · {summary.number}
        </p>
        <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-micro", TONE[summary.tone])} data-testid={`order-board-status-${board.id}`}>
          {summary.status}
        </span>
      </div>
      <p className="truncate text-caption text-muted">{summary.line}</p>
      <ol className="flex items-start justify-between gap-0.5" aria-label="Where the order is">
        {summary.steps.map((step) => (
          <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
            <span aria-hidden="true" className={cx("size-2 rounded-full", DOT[step.state])} />
            <span className={cx("w-full truncate text-center text-micro", step.state === "todo" ? "text-muted-2" : "text-text-2")}>
              {step.label}
              <span className="sr-only">{step.state === "done" ? ", done" : step.state === "current" ? ", now" : ""}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-auto flex flex-wrap gap-1.5">
        <Link href={summary.trackingHref as Route} className={DOOR} aria-label={`Tracking, ${name}`} data-testid={`order-board-tracking-${board.id}`}>
          Tracking
        </Link>
        {order}
      </div>
    </div>
  );
}
