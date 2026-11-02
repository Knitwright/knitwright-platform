"use client";

import { useState, type CSSProperties } from "react";
import {
  BOARDS,
  inputsOf,
  kindsAddableAfter,
  type BoardKind,
  type BoardView,
  type EmptyState,
  type Graph,
} from "@/lib/launch";

type Props = Readonly<{
  graph: Graph;
  selectedId: string | null;
  zoom: number;
  busy: boolean;
  empty: EmptyState | null;
  onSelect: (boardId: string | null, image?: boolean) => void;
  onAdd: (kind: BoardKind, fromBoardId?: string) => void;
}>;

/** The dotted canvas, drawn here rather than in the shared stylesheet, which this workstream does not own. */
const DOTS: CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

const STATUS_WORDS: Readonly<Record<BoardView["status"], string>> = {
  empty: "Nothing yet",
  queued: "Waiting to run",
  running: "Running",
  ready: "Ready",
  failed: "It did not finish",
};

/**
 * The canvas of boards (spec F-L4). Each board shows its kind, its status, what feeds it and a
 * connector dot whose Add… menu offers only the boards the spec's table lets it feed.
 *
 * The canvas scrolls rather than panning with a mouse drag, as the collection board already does: a
 * launch project is opened on a phone as well as a desktop, and a scrollable region works with a
 * keyboard and a screen reader as it stands. The zoom scales the boards, and the region keeps its
 * own scrollbars, so nothing is reachable only by dragging.
 */
export function BoardCanvas({ graph, selectedId, zoom, busy, empty, onSelect, onAdd }: Props) {
  return (
    <section aria-label="Canvas" data-testid="launch-canvas" style={DOTS} className="flex min-h-0 flex-1 flex-col overflow-auto rounded-3xl border border-hairline p-4">
      {graph.boards.length === 0 ? (
        <EmptyCanvas empty={empty} busy={busy} onAdd={onAdd} />
      ) : (
        <>
          {/* Boards but no Design board: the boards are still shown, with the one action that
              gives them a garment to start from. Hiding them would hide the person's own work. */}
          {empty ? <MissingDesign empty={empty} busy={busy} onAdd={onAdd} /> : null}
          <ul className="flex min-w-max flex-wrap items-start gap-4" style={{ zoom: `${zoom}%` }} data-testid="launch-boards">
            {graph.boards.map((board) => (
              <li key={board.id}>
                <Board board={board} graph={graph} selected={board.id === selectedId} busy={busy} onSelect={onSelect} onAdd={onAdd} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type EmptyProps = Readonly<{ empty: EmptyState | null; busy: boolean; onAdd: (kind: BoardKind) => void }>;

function EmptyCanvas({ empty, busy, onAdd }: EmptyProps) {
  if (!empty) return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center" data-testid="launch-empty">
      <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{empty.title}</h2>
      <p className="max-w-md text-[15px] leading-relaxed text-muted">{empty.body}</p>
      <AddDesign label={empty.action} busy={busy} onAdd={onAdd} />
    </div>
  );
}

function MissingDesign({ empty, busy, onAdd }: Readonly<{ empty: EmptyState; busy: boolean; onAdd: (kind: BoardKind) => void }>) {
  return (
    <div role="status" data-testid="launch-missing-design" className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-warn-wash px-4 py-3">
      <p className="min-w-56 flex-1 text-[13px] leading-relaxed text-warn">{empty.body}</p>
      <AddDesign label={empty.action} busy={busy} onAdd={onAdd} />
    </div>
  );
}

function AddDesign({ label, busy, onAdd }: Readonly<{ label: string; busy: boolean; onAdd: (kind: BoardKind) => void }>) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onAdd("design")}
      className="chip-btn inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 text-sm font-medium text-ink"
      data-testid="launch-empty-action"
    >
      {label}
    </button>
  );
}

type BoardProps = Readonly<{
  board: BoardView;
  graph: Graph;
  selected: boolean;
  busy: boolean;
  onSelect: (boardId: string | null, image?: boolean) => void;
  onAdd: (kind: BoardKind, fromBoardId?: string) => void;
}>;

function Board({ board, graph, selected, busy, onSelect, onAdd }: BoardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const info = BOARDS[board.kind];
  const inputs = inputsOf(graph, board.id);
  const addable = kindsAddableAfter(board.kind);

  return (
    <article
      aria-label={`${info.label} board`}
      data-testid={`board-${board.id}`}
      className={`flex w-64 flex-col gap-2 rounded-2xl border bg-tile-2/90 p-3 ${selected ? "border-cobalt" : "border-white/15"}`}
    >
      <button
        type="button"
        aria-pressed={selected}
        // The two lines inside read "Mockup" over "Flat lay", which as one accessible name would
        // be "Mockup Flat lay". The label says what pressing it does instead.
        aria-label={`Select ${board.name || info.label}`}
        onClick={() => onSelect(selected ? null : board.id)}
        className="flex min-h-10 flex-col items-start gap-0.5 rounded-xl px-1 text-left"
      >
        <span className="font-mono text-[11px] tracking-[0.08em] text-chalk-muted uppercase">{info.label}</span>
        <span className="text-[15px] font-medium text-ink">{board.name || info.label}</span>
      </button>

      <dl className="flex flex-col gap-0.5 px-1 text-[12px] text-chalk-muted">
        <div className="flex gap-1">
          <dt>Status</dt>
          <dd className="text-ink-2">{STATUS_WORDS[board.status]}</dd>
        </div>
        {board.inputVersion === null ? null : (
          <div className="flex gap-1">
            <dt>Design version</dt>
            <dd className="text-ink-2">{board.inputVersion}</dd>
          </div>
        )}
        <div className="flex gap-1">
          <dt>Fed by</dt>
          <dd className="text-ink-2">{inputs.length === 0 ? (info.maxInputs === 0 ? "nothing, by design" : "nothing yet") : `${inputs.length} of ${info.maxInputs}`}</dd>
        </div>
        {board.lastCostCredits === null ? null : (
          <div className="flex gap-1">
            <dt>Last run cost</dt>
            <dd className="text-ink-2">{board.lastCostCredits} credits</dd>
          </div>
        )}
      </dl>

      {board.status === "ready" && board.outputFileId !== null ? (
        <button
          type="button"
          onClick={() => onSelect(board.id, true)}
          className="chip-btn inline-flex min-h-10 items-center justify-center rounded-xl border border-white/20 text-[13px] text-ink"
          data-testid={`board-picture-${board.id}`}
        >
          Select the picture
        </button>
      ) : null}

      {addable.length === 0 ? null : (
        <div className="relative flex justify-end">
          <button
            type="button"
            disabled={busy}
            aria-expanded={menuOpen}
            aria-controls={`add-menu-${board.id}`}
            onClick={() => setMenuOpen(!menuOpen)}
            className="chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3 text-[13px] text-ink"
            data-testid={`connector-${board.id}`}
          >
            Add…
          </button>
          {menuOpen ? (
            <ul id={`add-menu-${board.id}`} aria-label={`Add a board after ${board.name || info.label}`} className="glass absolute top-11 right-0 z-30 flex w-56 flex-col rounded-2xl p-2 shadow-lg">
              {addable.map((kind) => (
                <li key={kind}>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onAdd(kind, board.id);
                    }}
                    className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-[13px] text-ink hover:bg-tile-2"
                  >
                    {BOARDS[kind].label}
                    <span className="font-mono text-[11px] text-chalk-muted">{BOARDS[kind].paid ? "credits" : "free"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </article>
  );
}
