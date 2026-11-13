"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { NO_ORDER_BOARDS, type OrderBoardsData, type ProjectPanelId } from "@/lib/order-boards/types";

/**
 * The Tech pack and Order boards' data and the open/close state of the three project panels --
 * Share, Export and Order (plan v6 E4, decision 0148).
 *
 * THE OPEN/CLOSE API. Anything inside the provider opens a panel with `useProjectPanels().open(id)`
 * and closes it with `close()`: E2's right-panel buttons (through its slots), an Order board's "Order" button and
 * `/dev/canvas?panel=`. The panel is drawn by `ProjectPanels` (or an E2 slot), fixed to
 * the top right of the window, so it does not matter where the button that opened it sits. Closing
 * puts focus back on whatever had it when the panel opened.
 */

export { PROJECT_PANELS, type ProjectPanelId } from "@/lib/order-boards/types";

/** Marks a button that toggles a panel, so a press on it is not also a press "outside" the panel. */
export const PANEL_TRIGGER = "data-project-panel-trigger";

type Panels = Readonly<{
  panel: ProjectPanelId | null;
  open: (id: ProjectPanelId) => void;
  toggle: (id: ProjectPanelId) => void;
  close: () => void;
}>;

const DataContext = createContext<OrderBoardsData>(NO_ORDER_BOARDS);
const PanelsContext = createContext<Panels>({ panel: null, open: () => undefined, toggle: () => undefined, close: () => undefined });

export const useOrderBoards = (): OrderBoardsData => useContext(DataContext);
export const useProjectPanels = (): Panels => useContext(PanelsContext);

export function OrderBoardsProvider({ data, initial = null, children }: Readonly<{ data: OrderBoardsData; initial?: ProjectPanelId | null; children: ReactNode }>) {
  const [panel, setPanel] = useState<ProjectPanelId | null>(initial);
  const returnTo = useRef<HTMLElement | null>(null);

  const open = useCallback((id: ProjectPanelId) => {
    if (document.activeElement instanceof HTMLElement) returnTo.current = document.activeElement;
    setPanel(id);
  }, []);
  const close = useCallback(() => {
    setPanel(null);
    const back = returnTo.current;
    returnTo.current = null;
    if (back?.isConnected) back.focus();
  }, []);
  const toggle = useCallback((id: ProjectPanelId) => (panel === id ? close() : open(id)), [panel, open, close]);

  const panels = useMemo(() => ({ panel, open, toggle, close }), [panel, open, toggle, close]);
  return (
    <DataContext.Provider value={data}>
      <PanelsContext.Provider value={panels}>{children}</PanelsContext.Provider>
    </DataContext.Provider>
  );
}
