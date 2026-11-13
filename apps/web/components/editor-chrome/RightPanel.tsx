"use client";

import { History } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { linkedDesign } from "@/components/canvas/BoardDoors";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { useDismiss } from "@/components/ui/use-dismiss";
import { boardFilePath } from "@/lib/flows";
import { isGarmentKind, launchHistoryPath, type BoardView, type LaunchPanelProps } from "@/lib/launch";
import { POPOVER_SLOTS, type PopoverSlot } from "./slots";

/**
 * THE RIGHT PANEL (`08` §5.1 and §5.3; prototype e01 and e15; decision 0146), 310 px and always
 * there: **Share · Export · Order** on top, then the project's name with its version history, then
 * the inspector -- the project's colours and tools with nothing selected (`ProjectPanel`), or the
 * selected board's own inspector (`components/launch/Inspector.tsx`, E3's to fill).
 *
 * The three buttons open popovers E4 builds (`slots.ts`). Until then each opens a short popover
 * with the doors that already exist -- the tech pack, the Make page, the board's file, the
 * members' settings -- so none of them is a dead button.
 */

type Props = Readonly<{
  projectId: string;
  projectName: string;
  panel: LaunchPanelProps;
  children: ReactNode;
}>;

export function RightPanel({ projectId, projectName, panel, children }: Props) {
  return (
    <div className="relative flex w-full shrink-0 flex-col overflow-y-auto border-l lg:h-full lg:w-77.5 border-border bg-bg text-body" data-testid="editor-right-panel">
      <div role="group" aria-label="Share, export and order" className="flex items-center justify-end gap-2 px-4 pt-3.5 pb-1">
        <ChromePopover slot="share" label="Share" tone="plain" panel={panel} />
        <ChromePopover slot="export" label="Export" tone="ink" panel={panel} />
        <ChromePopover slot="order" label="Order" tone="gold" panel={panel} />
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 pt-3.5 pb-4.5 text-body-lg text-muted">
        <h1 className="truncate text-body-lg font-medium text-muted">{projectName}</h1>
        <Link href={launchHistoryPath(projectId) as Route} aria-label="Version history" className="grid size-8 place-items-center rounded-sm text-text-2 hover:bg-soft" data-testid="editor-history">
          <Icon icon={History} />
        </Link>
      </div>
      {children}
    </div>
  );
}

const TONES = {
  plain: "border border-border bg-bg text-text hover:bg-soft",
  ink: "bg-text text-on-dark hover:bg-text-2",
  gold: "bg-gold text-navy hover:bg-gold-2",
} as const;

function ChromePopover({ slot, label, tone, panel }: Readonly<{ slot: PopoverSlot; label: string; tone: keyof typeof TONES; panel: LaunchPanelProps }>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const [inside] = useState(() => [box, trigger]);
  useDismiss(open, close, inside, trigger);
  const Filled = POPOVER_SLOTS[slot];

  return (
    <span className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        className={cx("h-10 rounded-md px-3 text-body font-semibold transition-colors duration-fast", TONES[tone])}
        data-testid={`editor-${slot}`}
      >
        {label}
      </button>
      {open ? (
        <div
          ref={box}
          id={id}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className="absolute top-[calc(100%+8px)] right-0 z-[70] flex w-90 max-w-[calc(100vw-32px)] flex-col gap-3 rounded-2xl border border-border bg-bg p-4.5 text-body text-text shadow-e3 motion-safe:pop-in"
          data-testid={`editor-${slot}-popover`}
        >
          {Filled ? <Filled {...panel} close={close} /> : <Doors slot={slot} board={panel.context.selection?.board ?? null} panel={panel} />}
        </div>
      ) : null}
    </span>
  );
}

const DOOR = "self-start text-body font-semibold text-link hover:underline";

/** What each button offers until E4's popover lands: the real doors, and a line saying what is coming. */
function Doors({ slot, board, panel }: Readonly<{ slot: PopoverSlot; board: BoardView | null; panel: LaunchPanelProps }>) {
  const graph = { boards: panel.context.project.boards, edges: panel.context.project.edges };
  const design = board === null ? panel.context.project.designProjectId : isGarmentKind(board.kind) ? designOf(board) : linkedDesign(graph, board);
  if (slot === "share") {
    return (
      <>
        <h2 className="text-title text-text">Share</h2>
        <p className="text-small text-muted">Everyone in your brand can already open this project. Invite people to the brand from Settings.</p>
        <Link href="/settings" className={DOOR}>
          Members in Settings
        </Link>
      </>
    );
  }
  if (slot === "export") {
    return (
      <>
        <h2 className="text-title text-text">Export</h2>
        {board?.outputFileId ? (
          <a href={boardFilePath(board.outputFileId)} target="_blank" rel="noopener" className={DOOR}>
            Download {board.name || "this board"}
          </a>
        ) : (
          <p className="text-small text-muted">Select a board that has run to download its picture.</p>
        )}
        {design ? (
          <Link href={`/studio/${design}/tech-pack` as Route} className={DOOR}>
            Tech pack and production files
          </Link>
        ) : null}
      </>
    );
  }
  return (
    <>
      <h2 className="text-title text-text">Order</h2>
      {design ? (
        <>
          <p className="text-small text-muted">A sample or a run of this garment goes through the same checks as every order.</p>
          <Link href={`/studio/${design}/make` as Route} className={DOOR}>
            Order a sample or a run
          </Link>
        </>
      ) : (
        <p className="text-small text-muted">Select a garment board to order it.</p>
      )}
      <Link href="/orders" className={DOOR}>
        Your orders
      </Link>
    </>
  );
}

const designOf = (board: BoardView): string | null => {
  const value = board.settings["designProjectId"];
  return typeof value === "string" && value.length > 0 ? value : null;
};
