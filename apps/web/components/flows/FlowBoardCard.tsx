"use client";

import type { ReactNode } from "react";
import { inputState, type AddItem, type ConnectTarget } from "@/lib/flows";
import { BOARDS, isLinkedKind, type BoardView, type Graph } from "@/lib/launch";
import type { ArrowKey } from "@/lib/flows";
import { AddList, ConnectList } from "./BoardLists";

/**
 * One board on the flow canvas: what it is, what feeds it, what it is doing now, and the three
 * things a person does to it -- select it, run it, and wire it to something else.
 *
 * Every control is a real button with a label that says what pressing it does, because two lines of
 * text inside a card do not make an accessible name. A control that cannot be used stays on screen
 * and says why, rather than disappearing: a canvas where buttons come and go is a canvas nobody
 * learns.
 */

const STATUS_WORDS: Readonly<Record<BoardView["status"], string>> = {
  empty: "Nothing yet",
  queued: "Waiting to run",
  running: "Running",
  ready: "Ready",
  failed: "It did not finish",
};

const CHIP = "chip-btn inline-flex min-h-9 items-center rounded-full border border-white/20 px-3 text-[12px] text-ink";

export type FlowBoardCardProps = Readonly<{
  board: BoardView;
  graph: Graph;
  selected: boolean;
  busy: boolean;
  /** What this board is doing right now, or null. A run takes time; a frozen card says nothing. */
  progress: string | null;
  menuOpen: boolean;
  connectingOpen: boolean;
  addItems: readonly AddItem[];
  targets: readonly ConnectTarget[];
  onSelect: () => void;
  onMenu: () => void;
  onConnecting: () => void;
  onAdd: (item: AddItem) => void;
  onConnect: (target: ConnectTarget) => void;
  onRun: () => void;
  onRunDownstream: () => void;
  onMove: (key: ArrowKey, shift: boolean) => void;
  /** The one canvas's own doors on this board (decision 0145): "Open in editor", "Open tech pack". */
  extra?: ReactNode;
  /** True when the Add… and Connect lists are drawn by the canvas rather than under the card. */
  detachedLists?: boolean;
}>;

export function FlowBoardCard(props: FlowBoardCardProps) {
  const { board, graph, selected, busy, progress } = props;
  const info = BOARDS[board.kind];
  const name = board.name || info.label;

  return (
    <article
      // The card is named after what it is, as L1's own board was, so a test and a screen reader
      // can both ask for "the Mockup board" rather than for the third card on the canvas.
      aria-label={`${info.label} board`}
      data-testid={`flow-board-${board.id}`}
      className={`relative flex h-full flex-col gap-1 rounded-2xl border bg-tile-2/95 p-3 ${selected ? "border-cobalt" : "border-white/15"}`}
    >
      {/*
        The kind is an eyebrow over the name, and it sits **outside** the button on purpose. Inside
        it, the words a person reads on the button would be "MOCKUP Front render" while its name is
        "Select Front render", and a name that does not contain the visible words is WCAG 2.5.3's
        "Label in Name" failure -- somebody driving the page by voice reads the button and cannot
        say its name. `aria-hidden` does not fix that, because the words are still on the screen:
        axe compares the *visible* text, which is the whole point of the rule. The card's own
        `aria-label` says the kind to a screen reader, so nothing is lost by hiding it here.
      */}
      {/* The two lines keep the spacing they had when both were inside the button. */}
      <div className="flex flex-col gap-0.5">
        <span aria-hidden="true" className="px-1 font-mono text-[10px] tracking-[0.08em] text-ink-2 uppercase">
          {info.label}
        </span>
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`Select ${name}`}
          disabled={busy}
          onClick={props.onSelect}
          className="flex min-h-7 items-start rounded-xl px-1 text-left"
        >
          <span className="truncate text-[14px] font-medium text-ink">{name}</span>
        </button>
      </div>

      <p className="px-1 text-[11px] leading-snug text-ink-2" data-testid={`flow-board-state-${board.id}`}>
        {progress ?? STATUS_WORDS[board.status]} · {inputState(graph, board)}
        {board.lastCostCredits === null ? "" : ` · last run ${board.lastCostCredits} credits`}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {/* A tech pack or an order follows its garment and is never run (decision 0145). */}
        {info.maxInputs === 0 || isLinkedKind(board.kind) ? null : (
          <button
            type="button"
            disabled={busy}
            aria-label={`Regenerate ${name}`}
            onClick={props.onRun}
            className={CHIP}
            data-testid={`flow-run-${board.id}`}
          >
            Regenerate
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          // Each of these names starts with the words on the control, because a name that does not
          // contain the visible text is WCAG 2.5.3's "Label in Name" failure: somebody who says
          // "run all downstream" to a voice control must be heard.
          aria-label={`Run all downstream from ${name}`}
          onClick={props.onRunDownstream}
          className={CHIP}
          data-testid={`flow-run-downstream-${board.id}`}
        >
          Run all downstream
        </button>
        {props.extra}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* The right-edge dot of the spec, as a labelled button: a dot alone is not operable. */}
        {props.addItems.length === 0 ? null : (
          <button
            type="button"
            disabled={busy}
            aria-expanded={props.menuOpen}
            aria-controls={`flow-add-${board.id}`}
            aria-label={`Add… a board after ${name}`}
            onClick={props.onMenu}
            className={CHIP}
            data-testid={`flow-add-open-${board.id}`}
          >
            Add…
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          aria-expanded={props.connectingOpen}
          aria-controls={`flow-connect-${board.id}`}
          aria-label={`Connect from here, ${name} into another board`}
          onClick={props.onConnecting}
          className={CHIP}
          data-testid={`flow-connect-open-${board.id}`}
        >
          Connect from here
        </button>
        {/* The nudge buttons take no room until one is reached with Tab (the arrow keys on a board do
            the same), so the card's controls fit its box on the one canvas (decision 0148). */}
        <span className="flex gap-1 not-focus-within:sr-only">
          {(
            [
              ["ArrowLeft", "left"],
              ["ArrowRight", "right"],
              ["ArrowUp", "up"],
              ["ArrowDown", "down"],
            ] as const
          ).map(([key, word]) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => props.onMove(key, false)}
              aria-label={`Move ${name} ${word}`}
              className="chip-btn inline-flex size-8 items-center justify-center rounded-full border border-white/20 text-[11px] text-ink-2"
              data-testid={`flow-move-${word}-${board.id}`}
            >
              {word === "left" ? "←" : word === "right" ? "→" : word === "up" ? "↑" : "↓"}
            </button>
          ))}
        </span>
      </div>

      {/* Both lists are always rendered and hidden when closed, so each button's `aria-controls`
          always names a panel that really exists. The one canvas draws them over the plane instead
          (`detachedLists`, decision 0145). */}
      {props.detachedLists ? null : (
        <>
          <AddList boardId={board.id} name={name} open={props.menuOpen} items={props.addItems} onAdd={props.onAdd} className="absolute top-full right-0 mt-1" />
          <ConnectList boardId={board.id} name={name} open={props.connectingOpen} targets={props.targets} onConnect={props.onConnect} className="absolute top-full right-0 mt-1" />
        </>
      )}
    </article>
  );
}
