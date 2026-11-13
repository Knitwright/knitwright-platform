"use client";

import { Hash } from "lucide-react";
import { useCanvas, useCanvasStore } from "@/components/canvas/CanvasStore";
import { RailPanel } from "@/components/launch/RailPanels";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { boxOf } from "@/lib/canvas";
import { BOARDS, type BoardView, type LaunchPanelProps } from "@/lib/launch";

/**
 * THE LAYERS FLYOUT (`08` §5.4 "Layers"; prototype e12; decision 0146).
 *
 * Every board on the canvas, in reading order, read from the canvas store: pressing one selects it
 * and brings it onto the screen (the store's `select` and `reveal`), so a board panned far away is
 * one press from view. Under the list, the selected board's own layers -- L4's layer list, the
 * launch rail's Layers panel -- so nothing it did is lost.
 */

/** Top to bottom, then left to right, as a person reads the canvas. */
const reading = (boards: readonly BoardView[]): readonly BoardView[] => [...boards].sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);

export function LayersFlyout({ panel }: Readonly<{ panel: LaunchPanelProps }>) {
  const store = useCanvasStore();
  const selection = useCanvas((state) => state.selection);
  const boards = reading(panel.context.project.boards);

  const choose = (board: BoardView) => {
    store.select(board.id);
    store.reveal(boxOf(board));
  };

  return (
    <div className="flex flex-col gap-4" data-testid="editor-layers">
      {boards.length === 0 ? (
        <p className="text-small text-muted">Nothing on the canvas yet. Add a product or a template to start.</p>
      ) : (
        <ul aria-label="Boards on the canvas" className="flex flex-col">
          {boards.map((board) => {
            const chosen = selection.includes(board.id);
            return (
              <li key={board.id}>
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => choose(board)}
                  className={cx("flex h-10.5 w-full items-center gap-2 rounded-sm px-2.5 text-left text-body text-text", chosen ? "bg-electric-soft" : "hover:bg-soft")}
                  data-testid={`editor-layer-${board.id}`}
                >
                  <Icon icon={Hash} size={16} className="text-text-2" />
                  <span className="truncate">{board.name || BOARDS[board.kind].label}</span>
                  <span className="ml-auto shrink-0 text-caption text-muted">{BOARDS[board.kind].label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <section aria-label="Layers of the selected board" className="flex flex-col gap-2 border-t border-border pt-3">
        <h3 className="text-body font-semibold text-text">In the selected board</h3>
        <RailPanel id="layers" hidden={false} panel={panel} />
      </section>
    </div>
  );
}
