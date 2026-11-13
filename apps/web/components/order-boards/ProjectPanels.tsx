"use client";

import { useCanvas } from "@/components/canvas/CanvasStore";
import type { PopoverSlotProps } from "@/components/editor-chrome/slots";
import { primaryOf } from "@/lib/canvas";
import type { ArtboardUnit, Graph } from "@/lib/launch";
import { designFor, designsOf } from "@/lib/order-boards/canvas";
import type { OrderableDesign } from "@/lib/order-boards/types";
import { ExportPopover } from "./ExportPopover";
import { useOrderBoards, useProjectPanels } from "./OrderBoardsContext";
import { OrderDrawer } from "./OrderDrawer";
import { PanelFrame } from "./PanelFrame";
import { SharePopover } from "./SharePopover";

/**
 * Where the Share and Export popovers and the Order drawer are mounted (plan v6 E4, decision 0148).
 *
 *   * **E2's right panel** (`components/editor-chrome/slots.ts`): its Share · Export · Order buttons
 *     open `ShareSlot`, `ExportSlot` and `OrderSlot`, for the design of the selected board.
 *   * **Anything else on the canvas** -- an Order board's Order button, `/dev/canvas?panel=` -- opens
 *     a panel through `useProjectPanels()`, and `ProjectPanels` draws it.
 *
 * Both act on the selected garment board's design, or the garment feeding a selected tech pack or
 * order board, else the canvas's first design.
 */

function useDesign(graph: Graph, selected: string | null): OrderableDesign | null {
  const { garments } = useOrderBoards();
  return designFor(graph, selected, designsOf(graph, garments));
}

/** The panel `useProjectPanels().open(id)` asked for, fixed under the right panel's buttons. */
export function ProjectPanels({ graph, unit }: Readonly<{ graph: Graph; unit: ArtboardUnit }>) {
  const { panel, close } = useProjectPanels();
  const selectedId = useCanvas(primaryOf);
  const design = useDesign(graph, selectedId);
  return <Panel id={panel} graph={graph} unit={unit} design={design} selectedId={selectedId} close={close} />;
}

type PanelProps = Readonly<{ id: string | null; graph: Graph; unit: ArtboardUnit; design: OrderableDesign | null; selectedId: string | null; close: () => void }>;

function Panel({ id, graph, unit, design, selectedId, close }: PanelProps) {
  if (id === "share") return <SharePopover design={design} onClose={close} />;
  if (id === "export") return <ExportPopover boards={graph.boards} design={design} unit={unit} selectedId={selectedId} onClose={close} />;
  if (id !== "order") return null;
  return design === null ? (
    <PanelFrame title="Order" onClose={close} testId="order-drawer">
      <p className="text-small text-muted">Add a garment board first: an order is made from a garment.</p>
    </PanelFrame>
  ) : (
    <OrderDrawer key={design.id} design={design} onClose={close} />
  );
}

/** E2's right-panel slots: the panel contract's props and `close`. */
const slot = (id: "share" | "export" | "order") =>
  function Slot({ context, close }: PopoverSlotProps) {
    const graph = { boards: context.project.boards, edges: context.project.edges };
    const selectedId = context.selection?.board.id ?? null;
    const design = useDesign(graph, selectedId);
    return <Panel id={id} graph={graph} unit={context.unit} design={design} selectedId={selectedId} close={close} />;
  };

export const ShareSlot = slot("share");
export const ExportSlot = slot("export");
export const OrderSlot = slot("order");
