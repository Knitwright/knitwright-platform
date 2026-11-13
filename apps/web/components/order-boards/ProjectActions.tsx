"use client";

import { Download } from "lucide-react";
import { useCanvas } from "@/components/canvas/CanvasStore";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { primaryOf, type GarmentPreview } from "@/lib/canvas";
import type { ArtboardUnit, Graph } from "@/lib/launch";
import { designFor, designsOf, orderGate } from "@/lib/order-boards/canvas";
import type { OrderableDesign } from "@/lib/order-boards/types";
import { ExportPopover } from "./ExportPopover";
import { PANEL_TRIGGER, useProjectPanels, type ProjectPanelId } from "./OrderBoardsContext";
import { OrderDrawer } from "./OrderDrawer";
import { PanelFrame } from "./PanelFrame";
import { SharePopover } from "./SharePopover";

/**
 * The canvas's Share · Export · Order (plan v6 E4, decision 0148; `08` v3.6 right panel header:
 * Share outlined, Export black, Order gold) and the one panel that is open.
 *
 * `ProjectActions` is the three buttons; `ProjectPanels` draws whichever panel is open. Both read the
 * canvas store's selection, so the panels act on the selected garment board's design, or the design
 * of the garment feeding a selected tech pack or order board, or else the canvas's first design.
 * E2's right panel can mount the buttons where its header is, or call `useProjectPanels().toggle`
 * from its own; the panels do not move.
 */

type Props = Readonly<{
  graph: Graph;
  /** What every garment board shows, by design id: its name, version and last validation. */
  garments: Readonly<Record<string, GarmentPreview | null>>;
  unit: ArtboardUnit;
}>;

function useDesign(graph: Graph, garments: Props["garments"]): OrderableDesign | null {
  const selected = useCanvas(primaryOf);
  return designFor(graph, selected, designsOf(graph, garments));
}

const trigger = { [PANEL_TRIGGER]: "" };

export function ProjectActions({ graph, garments }: Omit<Props, "unit">) {
  const { panel, toggle } = useProjectPanels();
  const design = useDesign(graph, garments);
  const gate = orderGate(design);
  const pressed = (id: ProjectPanelId) => ({ "aria-expanded": panel === id, "aria-haspopup": "dialog" as const, ...trigger });
  return (
    <div className="flex items-center gap-2" data-testid="project-actions">
      <Button variant="secondary" size="sm" onClick={() => toggle("share")} {...pressed("share")} data-testid="project-share">
        Share
      </Button>
      <Button variant="primary" size="sm" icon={<Icon icon={Download} size={14} />} onClick={() => toggle("export")} {...pressed("export")} data-testid="project-export">
        Export
      </Button>
      <Button
        variant="premium"
        size="sm"
        onClick={() => toggle("order")}
        disabledReason={gate.open ? undefined : gate.reason}
        {...pressed("order")}
        data-testid="project-order"
      >
        Order
      </Button>
    </div>
  );
}

export function ProjectPanels({ graph, garments, unit }: Props) {
  const { panel, close } = useProjectPanels();
  const design = useDesign(graph, garments);
  if (panel === "share") return <SharePopover design={design} onClose={close} />;
  if (panel === "export") return <ExportPopover boards={graph.boards} design={design} unit={unit} onClose={close} />;
  if (panel === "order") {
    return design === null ? (
      <OrderDrawerEmpty onClose={close} />
    ) : (
      <OrderDrawer key={design.id} design={design} onClose={close} />
    );
  }
  return null;
}

/** The Order drawer on a canvas with no garment board: it says what to do first. */
function OrderDrawerEmpty({ onClose }: Readonly<{ onClose: () => void }>) {
  return (
    <PanelFrame title="Order" onClose={onClose} testId="order-drawer">
      <p className="text-small text-muted">Add a garment board first: an order is made from a garment.</p>
    </PanelFrame>
  );
}
